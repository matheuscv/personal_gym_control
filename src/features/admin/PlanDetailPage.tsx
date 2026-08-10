import { type FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addExerciseToPlan,
  fetchExercises,
  fetchPlan,
  fetchPlanExercises,
  removePlanExercise,
  swapPlanExerciseOrder,
  updatePlanExercise,
} from './api';

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

  const [exerciseId, setExerciseId] = useState('');
  const [targetSets, setTargetSets] = useState('3');
  const [targetReps, setTargetReps] = useState('');
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-plan-exercises', id] });
    queryClient.invalidateQueries({ queryKey: ['daily-workout'] });
  }

  const addMutation = useMutation({
    mutationFn: addExerciseToPlan,
    onSuccess: () => {
      invalidate();
      setExerciseId('');
      setTargetSets('3');
      setTargetReps('');
    },
    onError: (err: Error) => setError(err.message),
  });

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

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!exerciseId) {
      setError('Selecione um exercício.');
      return;
    }
    addMutation.mutate({
      plan_id: id,
      exercise_id: Number(exerciseId),
      target_sets: targetSets ? Number(targetSets) : null,
      target_reps: targetReps.trim() || null,
    });
  }

  const items = planExercisesQuery.data ?? [];

  return (
    <div className="admin-section">
      <h2>{planQuery.data?.name ?? 'Plano'}</h2>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Ordem</th>
            <th>Exercício</th>
            <th>Séries alvo</th>
            <th>Reps alvo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => swapMutation.mutate([item, items[index - 1]])}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={() => swapMutation.mutate([item, items[index + 1]])}
                >
                  ↓
                </button>
              </td>
              <td>{item.exercise_name}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  defaultValue={item.target_sets ?? ''}
                  onBlur={(e) =>
                    updateMutation.mutate({
                      id: item.id,
                      target_sets: e.target.value === '' ? null : Number(e.target.value),
                      target_reps: item.target_reps,
                    })
                  }
                />
              </td>
              <td>
                <input
                  defaultValue={item.target_reps ?? ''}
                  placeholder="ex: 8-12"
                  onBlur={(e) =>
                    updateMutation.mutate({
                      id: item.id,
                      target_sets: item.target_sets,
                      target_reps: e.target.value.trim() || null,
                    })
                  }
                />
              </td>
              <td>
                <button type="button" onClick={() => removeMutation.mutate(item.id)}>
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="admin-form" onSubmit={handleAdd}>
        <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
          <option value="">Selecione um exercício...</option>
          {exercisesQuery.data?.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          placeholder="Séries"
          value={targetSets}
          onChange={(e) => setTargetSets(e.target.value)}
        />
        <input
          placeholder="Reps alvo (ex: 8-12)"
          value={targetReps}
          onChange={(e) => setTargetReps(e.target.value)}
        />
        <button type="submit" disabled={addMutation.isPending}>
          Adicionar ao plano
        </button>
      </form>
      {error && <p className="admin-error">{error}</p>}
    </div>
  );
}
