import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '../../components/EmptyState';
import { fetchActivePlans, loadDailyWorkout, updateSessionSet } from './api';
import { enqueuePatch, flushQueue, getQueuedCount } from './offlineQueue';
import type { SessionSet, SessionSetPatch } from './types';
import './DailyWorkoutPage.css';

export function DailyWorkoutPage() {
  const plansQuery = useQuery({ queryKey: ['active-plans'], queryFn: fetchActivePlans });
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedPlanId == null && plansQuery.data && plansQuery.data.length > 0) {
      setSelectedPlanId(plansQuery.data[0].id);
    }
  }, [plansQuery.data, selectedPlanId]);

  const workoutQuery = useQuery({
    queryKey: ['daily-workout', selectedPlanId],
    queryFn: () => loadDailyWorkout(selectedPlanId!),
    enabled: selectedPlanId != null,
  });

  const queryClient = useQueryClient();
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(() => getQueuedCount());

  useEffect(() => {
    if (workoutQuery.data) setSets(workoutQuery.data.sets);
  }, [workoutQuery.data]);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const { succeeded } = await flushQueue(updateSessionSet);
    setQueuedCount(getQueuedCount());
    if (succeeded > 0) {
      queryClient.invalidateQueries({ queryKey: ['daily-workout', selectedPlanId] });
    }
  }, [queryClient, selectedPlanId]);

  useEffect(() => {
    syncQueue();

    function handleOnline() {
      setIsOffline(false);
      syncQueue();
    }
    function handleOffline() {
      setIsOffline(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  const setsByExercise = useMemo(() => {
    const map = new Map<number, SessionSet[]>();
    for (const set of sets) {
      if (set.plan_exercise_id == null) continue;
      const list = map.get(set.plan_exercise_id) ?? [];
      list.push(set);
      map.set(set.plan_exercise_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.set_number - b.set_number);
    return map;
  }, [sets]);

  async function persist(setId: number, patch: SessionSetPatch) {
    setSets((prev) => prev.map((s) => (s.id === setId ? { ...s, ...patch } : s)));

    if (!navigator.onLine) {
      enqueuePatch(setId, patch);
      setQueuedCount(getQueuedCount());
      return;
    }

    try {
      await updateSessionSet(setId, patch);
    } catch {
      // Falha pode ser de rede (sem conexão de fato, mesmo com navigator.onLine
      // true) ou do servidor. Enfileira para nao perder a alteracao — se for
      // erro do servidor, a proxima sincronizacao tambem vai falhar e o item
      // continua na fila, mas ao menos o dado digitado nao se perde.
      enqueuePatch(setId, patch);
      setQueuedCount(getQueuedCount());
    }
  }

  if (plansQuery.isLoading) {
    return (
      <div className="daily-workout">
        <h1>Treino do dia</h1>
        <p className="workout-status">Carregando planos...</p>
      </div>
    );
  }

  if (!plansQuery.data || plansQuery.data.length === 0) {
    return (
      <div className="daily-workout empty">
        <h1>Treino do dia</h1>
        <EmptyState
          icon={<Dumbbell size={34} />}
          title="Nenhum treino por aqui ainda"
          description="Crie um plano de treino para começar a registrar suas séries do dia a dia."
          actionLabel="Criar plano em Configuração"
          actionTo="/admin/plans"
        />
      </div>
    );
  }

  return (
    <div className="daily-workout">
      <h1>Treino do dia</h1>
      {(isOffline || queuedCount > 0) && (
        <p className="offline-banner">
          {isOffline
            ? `Você está offline — as alterações serão salvas quando a conexão voltar${queuedCount > 0 ? ` (${queuedCount} pendente${queuedCount > 1 ? 's' : ''})` : ''}.`
            : `Sincronizando ${queuedCount} alteração${queuedCount > 1 ? 'ões' : ''} pendente${queuedCount > 1 ? 's' : ''}...`}
        </p>
      )}
      <div className="plan-tabs">
        {plansQuery.data.map((plan) => (
          <button
            key={plan.id}
            type="button"
            className={plan.id === selectedPlanId ? 'active' : ''}
            onClick={() => setSelectedPlanId(plan.id)}
          >
            {plan.name}
          </button>
        ))}
      </div>

      {workoutQuery.isLoading && <p className="workout-status">Carregando treino do dia...</p>}
      {workoutQuery.isError && <p className="workout-error">Erro ao carregar o treino.</p>}

      {workoutQuery.data && workoutQuery.data.planExercises.length === 0 && (
        <p className="workout-status">Este plano ainda não tem exercícios cadastrados.</p>
      )}

      {workoutQuery.data && (
        <div className="exercise-list">
          {workoutQuery.data.planExercises.map((pe) => (
            <div key={pe.id} className="exercise-card">
              <div className="exercise-header">
                <h3>{pe.exercise_name}</h3>
                {pe.muscle_group && <span className="muscle-group">{pe.muscle_group}</span>}
              </div>
              {pe.target_reps && <p className="target-reps">Alvo: {pe.target_reps} reps</p>}

              <table className="sets-table">
                <thead>
                  <tr>
                    <th>Série</th>
                    <th>Reps</th>
                    <th>Peso (kg)</th>
                    <th>Tempo (s)</th>
                    <th>Feito</th>
                  </tr>
                </thead>
                <tbody>
                  {(setsByExercise.get(pe.id) ?? []).map((set) => (
                    <tr key={set.id} className={set.completed ? 'completed' : ''}>
                      <td>{set.set_number}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          defaultValue={set.reps ?? ''}
                          onBlur={(e) =>
                            persist(set.id, {
                              reps: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          defaultValue={set.weight_kg ?? ''}
                          onBlur={(e) =>
                            persist(set.id, {
                              weight_kg: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          defaultValue={set.duration_seconds ?? ''}
                          onBlur={(e) =>
                            persist(set.id, {
                              duration_seconds: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`check-btn ${set.completed ? 'checked' : ''}`}
                          aria-pressed={set.completed}
                          aria-label={set.completed ? 'Marcar como não concluída' : 'Marcar como concluída'}
                          onClick={() => persist(set.id, { completed: !set.completed })}
                        >
                          ✓
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
