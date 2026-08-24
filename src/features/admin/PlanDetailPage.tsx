import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, ChevronDown, PlayCircle, Trash2 } from 'lucide-react';
import { youtubeSearchUrl } from '../../lib/youtube';
import {
  addExerciseToPlan,
  fetchExercises,
  fetchPlan,
  fetchPlanExercises,
  removePlanExercise,
  swapPlanExerciseOrder,
  updatePlanExercise,
  upsertExerciseByName,
} from './api';
import { ExerciseLibraryPicker } from './ExerciseLibraryPicker';
import { EXERCISE_LIBRARY, type MetricType } from './exerciseLibrary';
import './PlanDetailPage.css';

export function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const id = Number(planId);
  const queryClient = useQueryClient();

  const planQuery = useQuery({ queryKey: ['admin-plan', id], queryFn: () => fetchPlan(id) });
  const planExercisesQuery = useQuery({
    queryKey: ['admin-plan-exercises', id],
    queryFn: () => fetchPlanExercises(id),
  });
  const exercisesQuery = useQuery({ queryKey: ['admin-exercises'], queryFn: fetchExercises });

  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-plan-exercises', id] });
    queryClient.invalidateQueries({ queryKey: ['admin-exercises'] });
    queryClient.invalidateQueries({ queryKey: ['daily-workout'] });
  }

  const addMutation = useMutation({
    mutationFn: async (input: {
      muscle_group: string;
      name: string;
      target_sets: number;
      target_reps: string;
      metric_type: MetricType;
    }) => {
      const exercise = await upsertExerciseByName({
        name: input.name,
        muscle_group: input.muscle_group,
        metric_type: input.metric_type,
      });
      await addExerciseToPlan({
        plan_id: id,
        exercise_id: exercise.id,
        target_sets: input.target_sets,
        target_reps: input.target_reps,
      });
    },
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  const existingNames = useMemo(
    () => new Set((planExercisesQuery.data ?? []).map((item) => item.exercise_name)),
    [planExercisesQuery.data]
  );

  const libraryNames = useMemo(
    () => new Set(EXERCISE_LIBRARY.flatMap((group) => group.exercises.map((ex) => ex.name))),
    []
  );

  const myExercisesGroup = useMemo(() => {
    const mine = (exercisesQuery.data ?? []).filter((ex) => !libraryNames.has(ex.name));
    if (mine.length === 0) return undefined;
    return [
      {
        muscle_group: 'Meus exercícios',
        exercises: mine.map((ex) => ({
          name: ex.name,
          target_sets: 3,
          target_reps: '',
          metric_type: ex.metric_type,
        })),
      },
    ];
  }, [exercisesQuery.data, libraryNames]);

  function handlePickExercise(
    muscleGroup: string,
    name: string,
    targetSets: number,
    targetReps: string,
    metricType: MetricType
  ) {
    if (existingNames.has(name)) return;
    setError(null);
    addMutation.mutate({
      muscle_group: muscleGroup,
      name,
      target_sets: targetSets,
      target_reps: targetReps,
      metric_type: metricType,
    });
  }

  const removeMutation = useMutation({ mutationFn: removePlanExercise, onSuccess: invalidate });

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; target_sets: number | null; target_reps: string | null }) =>
      updatePlanExercise(input.id, { target_sets: input.target_sets, target_reps: input.target_reps }),
    onSuccess: invalidate,
  });

  const swapMutation = useMutation({
    mutationFn: (input: Parameters<typeof swapPlanExerciseOrder>) => swapPlanExerciseOrder(...input),
    onSuccess: invalidate,
  });

  const items = planExercisesQuery.data ?? [];

  return (
    <div className="admin-section plan-detail-page">
      <span className="plan-detail-eyebrow">Editando plano</span>
      <h2 className="section-title">{planQuery.data?.name ?? 'Plano'}</h2>

      {!planExercisesQuery.isLoading && items.length === 0 && (
        <p className="library-empty">Este plano ainda não tem exercícios. Adicione um na biblioteca abaixo.</p>
      )}

      {items.length > 0 && (
        <ul className="plan-exercise-list">
          {items.map((item, index) => (
            <li key={item.id} className="plan-exercise-item">
              <div className="plan-exercise-order">
                <button
                  type="button"
                  className="btn-icon neutral"
                  disabled={index === 0}
                  aria-label="Mover para cima"
                  onClick={() => swapMutation.mutate([item, items[index - 1]])}
                >
                  <ChevronUp size={14} />
                </button>
                <span className="plan-exercise-index">{index + 1}</span>
                <button
                  type="button"
                  className="btn-icon neutral"
                  disabled={index === items.length - 1}
                  aria-label="Mover para baixo"
                  onClick={() => swapMutation.mutate([item, items[index + 1]])}
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              <span className="plan-exercise-name">{item.exercise_name}</span>

              <a
                className="video-link"
                href={youtubeSearchUrl(`${item.exercise_name} execução correta`)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ver vídeo de ${item.exercise_name} no YouTube`}
              >
                <PlayCircle size={15} />
                Vídeo
              </a>

              <div className="plan-exercise-controls">
                <input
                  type="number"
                  min={0}
                  defaultValue={item.target_sets ?? ''}
                  aria-label="Séries alvo"
                  onBlur={(e) =>
                    updateMutation.mutate({
                      id: item.id,
                      target_sets: e.target.value === '' ? null : Number(e.target.value),
                      target_reps: item.target_reps,
                    })
                  }
                />
                <span className="plan-exercise-x">×</span>
                <input
                  type="text"
                  defaultValue={item.target_reps ?? ''}
                  placeholder="8-12"
                  aria-label="Reps alvo"
                  onBlur={(e) =>
                    updateMutation.mutate({
                      id: item.id,
                      target_sets: item.target_sets,
                      target_reps: e.target.value.trim() || null,
                    })
                  }
                />
                <button
                  type="button"
                  className="btn-icon"
                  aria-label={`Remover ${item.exercise_name}`}
                  onClick={() => removeMutation.mutate(item.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="plan-detail-subheading">Adicionar exercício ao plano</h3>
      <p className="import-hint">
        Escolha um exercício da biblioteca (ou de "Meus exercícios") para adicionar ao plano com os valores
        padrão de séries/repetições — depois ajuste na lista acima se quiser.
      </p>
      {addMutation.isPending && <p className="admin-status">Adicionando...</p>}
      {error && <p className="admin-error">{error}</p>}

      <ExerciseLibraryPicker
        selectedNames={existingNames}
        onSelect={handlePickExercise}
        extraGroups={myExercisesGroup}
      />
    </div>
  );
}
