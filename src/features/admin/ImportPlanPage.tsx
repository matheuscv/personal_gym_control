import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Save, PencilLine, PlayCircle, X } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { importPlanSchema, type ImportPlanInput } from '../../../api/_lib/importSchema';
import { youtubeSearchUrl } from '../../lib/youtube';
import './ImportPlanPage.css';

const EXAMPLE = `{
  "name": "Treino A",
  "exercises": [
    { "name": "Supino reto", "muscle_group": "Peito", "target_sets": 3, "target_reps": "8-12" },
    { "name": "Agachamento", "muscle_group": "Pernas", "target_sets": 4, "target_reps": "10-15" }
  ]
}`;

export function ImportPlanPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ImportPlanInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleTextChange(value: string) {
    setText(value);
    if (preview) setPreview(null);
    if (error) setError(null);
  }

  function handlePreview() {
    setError(null);
    setSuccess(null);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      setError('JSON inválido: verifique a sintaxe.');
      return;
    }

    const parsed = importPlanSchema.safeParse(parsedJson);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
      return;
    }

    setPreview(parsed.data);
  }

  function handleCancel() {
    setText('');
    setPreview(null);
    setError(null);
  }

  async function handleSave() {
    if (!preview) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/import-workout-plan', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(preview),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? 'Falha ao importar.');
        return;
      }
      setSuccess(`Plano "${body.plan_name}" salvo com ${body.exercises_count} exercício(s).`);
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exercises'] });
      queryClient.invalidateQueries({ queryKey: ['active-plans'] });
      setTimeout(() => navigate(`/admin/plans/${body.plan_id}`), 1200);
    } catch {
      setError('Falha de rede ao importar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-section import-plan">
      <span className="import-plan-eyebrow">Colar JSON</span>
      <h2 className="section-title">Importar plano</h2>
      <p className="import-hint">
        Cole aqui o JSON gerado pelo Claude com o nome do plano e a lista de exercícios, pré-visualize e só
        depois salve. Reimportar um plano com o mesmo nome substitui os exercícios existentes.
      </p>

      <textarea
        className="import-textarea"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={EXAMPLE}
        rows={14}
        disabled={submitting}
      />

      {error && <p className="admin-error">{error}</p>}

      {!preview && (
        <button type="button" className="btn-primary" onClick={handlePreview} disabled={!text.trim()}>
          <Eye size={16} />
          Pré-visualizar
        </button>
      )}

      {preview && !success && (
        <div className="import-preview">
          <span className="import-preview-eyebrow">Prévia</span>
          <h3 className="import-preview-name">{preview.name}</h3>
          <ul className="import-preview-list">
            {preview.exercises.map((ex) => (
              <li key={ex.name} className="import-preview-item">
                <div className="import-preview-item-info">
                  <span className="import-preview-item-name">{ex.name}</span>
                  {ex.muscle_group && <span className="import-preview-item-group">{ex.muscle_group}</span>}
                </div>
                <div className="import-preview-item-right">
                  {(ex.target_sets || ex.target_reps) && (
                    <span className="import-preview-item-target">
                      {ex.target_sets ?? '—'} × {ex.target_reps ?? '—'}
                    </span>
                  )}
                  <a
                    className="import-preview-video"
                    href={youtubeSearchUrl(`${ex.name} execução correta`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ver vídeo de ${ex.name} no YouTube`}
                  >
                    <PlayCircle size={14} />
                  </a>
                </div>
              </li>
            ))}
          </ul>

          <div className="import-preview-actions">
            <button type="button" className="btn-ghost" onClick={handleCancel}>
              <X size={15} />
              Cancelar
            </button>
            <button type="button" className="btn-ghost" onClick={() => setPreview(null)}>
              <PencilLine size={15} />
              Editar JSON
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={submitting}>
              <Save size={16} />
              {submitting ? 'Salvando...' : 'Salvar plano'}
            </button>
          </div>
        </div>
      )}

      {success && <p className="import-success">{success}</p>}
    </div>
  );
}
