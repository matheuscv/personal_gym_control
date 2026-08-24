import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X, ClipboardList, PlayCircle } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { importPlanSchema } from '../../../api/_lib/importSchema';
import { youtubeSearchUrl } from '../../lib/youtube';
import { ExerciseLibraryPicker } from './ExerciseLibraryPicker';
import type { MetricType } from './exerciseLibrary';
import './CreatePlanPage.css';

interface SelectedExercise {
  name: string;
  muscle_group: string;
  target_sets: number;
  target_reps: string;
  metric_type: MetricType;
}

export function CreatePlanPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [planName, setPlanName] = useState('');
  const [selected, setSelected] = useState<Map<string, SelectedExercise>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleExercise(
    muscleGroup: string,
    name: string,
    targetSets: number,
    targetReps: string,
    metricType: MetricType = 'strength'
  ) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.set(name, {
          name,
          muscle_group: muscleGroup,
          target_sets: targetSets,
          target_reps: targetReps,
          metric_type: metricType,
        });
      }
      return next;
    });
  }

  function updateSelected(name: string, patch: Partial<Pick<SelectedExercise, 'target_sets' | 'target_reps'>>) {
    setSelected((prev) => {
      const current = prev.get(name);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(name, { ...current, ...patch });
      return next;
    });
  }

  async function handleCreate() {
    setError(null);
    setSuccess(null);

    const payload = {
      name: planName,
      exercises: Array.from(selected.values()).map((ex) => ({
        name: ex.name,
        muscle_group: ex.muscle_group,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        metric_type: ex.metric_type,
      })),
    };

    const parsed = importPlanSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/import-workout-plan', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? 'Falha ao criar plano.');
        return;
      }
      setSuccess(`Plano "${body.plan_name}" criado com ${body.exercises_count} exercício(s).`);
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exercises'] });
      queryClient.invalidateQueries({ queryKey: ['active-plans'] });
      queryClient.invalidateQueries({ queryKey: ['daily-workout'] });
      setTimeout(() => navigate(`/admin/plans/${body.plan_id}`), 1200);
    } catch {
      setError('Falha de rede ao criar plano.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedList = Array.from(selected.values());

  return (
    <div className="create-plan">
      <header className="create-plan-header">
        <span className="create-plan-eyebrow">Montar do zero</span>
        <h2 className="section-title">Criar plano</h2>
        <p className="create-plan-hint">
          Escolha exercícios da biblioteca por grupo muscular e monte um plano novo. Ajuste séries e repetições
          antes de salvar.
        </p>
      </header>

      <div className="create-plan-layout">
        <ExerciseLibraryPicker selectedNames={new Set(selected.keys())} onSelect={toggleExercise} />

        <aside className="plan-builder-panel">
          <label className="plan-name-field">
            <span>Nome do plano</span>
            <input
              type="text"
              placeholder="Ex.: Treino A"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
          </label>

          <div className="plan-builder-list-wrap">
            <div className="plan-builder-list-header">
              <ClipboardList size={15} />
              <span>Plano em construção</span>
              <span className="plan-builder-badge">{selectedList.length}</span>
            </div>

            {selectedList.length === 0 ? (
              <p className="plan-builder-empty">Selecione exercícios na biblioteca ao lado para começar.</p>
            ) : (
              <ul className="plan-builder-list">
                {selectedList.map((ex) => (
                  <li key={ex.name} className="plan-builder-item">
                    <div className="plan-builder-item-info">
                      <span className="plan-builder-item-name">{ex.name}</span>
                      <span className="plan-builder-item-group">{ex.muscle_group}</span>
                    </div>
                    <div className="plan-builder-item-controls">
                      <input
                        type="number"
                        min={1}
                        value={ex.target_sets}
                        onChange={(e) => updateSelected(ex.name, { target_sets: Number(e.target.value) || 1 })}
                        aria-label="Séries"
                      />
                      <span className="plan-builder-x">×</span>
                      <input
                        type="text"
                        value={ex.target_reps}
                        onChange={(e) => updateSelected(ex.name, { target_reps: e.target.value })}
                        aria-label="Repetições"
                      />
                      <a
                        className="plan-builder-video"
                        href={youtubeSearchUrl(`${ex.name} execução correta`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Ver vídeo de ${ex.name} no YouTube`}
                      >
                        <PlayCircle size={14} />
                      </a>
                      <button
                        type="button"
                        className="plan-builder-remove"
                        aria-label={`Remover ${ex.name}`}
                        onClick={() =>
                          toggleExercise(ex.muscle_group, ex.name, ex.target_sets, ex.target_reps, ex.metric_type)
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="admin-error">{error}</p>}
          {success && <p className="import-success">{success}</p>}

          <button
            type="button"
            className="plan-builder-submit"
            onClick={handleCreate}
            disabled={submitting || !planName.trim() || selectedList.length === 0}
          >
            {submitting ? 'Criando...' : 'Criar plano'}
          </button>
        </aside>
      </div>
    </div>
  );
}
