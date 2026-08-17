import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  PlayCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '../../components/EmptyState';
import { ProgressRing } from '../../components/ProgressRing';
import {
  completeSession,
  deleteSession,
  fetchScheduledPlanForDate,
  fetchSessionForDate,
  loadDailyWorkout,
  reopenSession,
  updateSessionSet,
} from './api';
import { enqueuePatch, flushQueue, getQueuedCount } from './offlineQueue';
import type { SessionSet, SessionSetPatch } from './types';
import { youtubeSearchUrl } from '../../lib/youtube';
import './DailyWorkoutPage.css';

const MAX_DAYS_BACK = 30;
const MAX_DAYS_FORWARD = 7;

// A versão Android não embarca a área de Configuração (admin) — sem
// agenda semanal pra configurar por lá, o CTA "Configurar Meu Treino"
// não tem pra onde levar o usuário.
const IS_ANDROID = import.meta.env.VITE_PLATFORM === 'android';

function dayLabel(offset: number, date: Date): string {
  if (offset === 0) return 'Hoje';
  if (offset === -1) return 'Ontem';
  if (offset === 1) return 'Amanhã';
  const weekday = format(date, 'EEEE', { locale: ptBR });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${format(date, 'dd/MM')}`;
}

export function DailyWorkoutPage() {
  const [searchParams] = useSearchParams();
  // O calendário da Home linka pra cá com ?date=yyyy-MM-dd — só serve
  // pra posicionar o offset inicial; a navegação por dia continua normal
  // (relativa a hoje) depois disso.
  const [dateOffset, setDateOffset] = useState(() => {
    const dateParam = searchParams.get('date');
    if (!dateParam) return 0;
    const parsed = new Date(`${dateParam}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return 0;
    const diff = differenceInCalendarDays(parsed, new Date());
    return Math.min(Math.max(diff, -MAX_DAYS_BACK), MAX_DAYS_FORWARD);
  });
  const targetDate = useMemo(() => addDays(new Date(), dateOffset), [dateOffset]);
  const dateKey = useMemo(() => format(targetDate, 'yyyy-MM-dd'), [targetDate]);

  // Uma sessão já existente pra essa data manda no plano de fato usado
  // nesse dia — só cai pra agenda ao vivo se ainda não existe sessão
  // (dia novo). Assim, mudar a agenda depois não "perde" nem duplica um
  // dia que já tinha treino registrado.
  const dateSessionQuery = useQuery({
    queryKey: ['session-for-date', dateKey],
    queryFn: () => fetchSessionForDate(dateKey),
  });
  const scheduleQuery = useQuery({
    queryKey: ['scheduled-plan', dateKey],
    queryFn: () => fetchScheduledPlanForDate(targetDate),
  });
  const planId = dateSessionQuery.data?.planId ?? scheduleQuery.data?.plan_id ?? null;
  const hasNoWorkout =
    !dateSessionQuery.isLoading && !scheduleQuery.isLoading && !dateSessionQuery.data && !scheduleQuery.data;

  const workoutQuery = useQuery({
    queryKey: ['daily-workout', dateKey],
    queryFn: () => loadDailyWorkout(planId!, targetDate),
    enabled: planId != null,
  });

  const queryClient = useQueryClient();
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(() => getQueuedCount());

  useEffect(() => {
    setSets([]);
    setCompletedAt(null);
  }, [dateOffset]);

  useEffect(() => {
    if (workoutQuery.data) {
      setSets(workoutQuery.data.sets);
      setCompletedAt(workoutQuery.data.completedAt);
    }
  }, [workoutQuery.data]);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const { succeeded } = await flushQueue(updateSessionSet);
    setQueuedCount(getQueuedCount());
    if (succeeded > 0) {
      queryClient.invalidateQueries({ queryKey: ['daily-workout', planId, dateKey] });
    }
  }, [queryClient, planId, dateKey]);

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

  const progressPercent = useMemo(() => {
    if (sets.length === 0) return 0;
    const done = sets.filter((s) => s.completed).length;
    return Math.round((done / sets.length) * 100);
  }, [sets]);

  async function handleCompleteDay() {
    if (!workoutQuery.data) return;
    if (progressPercent !== 100) {
      const confirmed = window.confirm(
        `Você concluiu ${progressPercent}% dos exercícios do dia. Deseja encerrar o dia mesmo assim?`
      );
      if (!confirmed) return;
    }
    const newCompletedAt = await completeSession(workoutQuery.data.sessionId);
    setCompletedAt(newCompletedAt);
    queryClient.invalidateQueries({ queryKey: ['daily-workout', planId, dateKey] });
  }

  async function handleReopenDay() {
    if (!workoutQuery.data) return;
    await reopenSession(workoutQuery.data.sessionId);
    setCompletedAt(null);
    queryClient.invalidateQueries({ queryKey: ['daily-workout', planId, dateKey] });
  }

  async function handleDeleteDay() {
    if (!workoutQuery.data) return;
    const confirmed = window.confirm(
      `Deseja mesmo excluir o treino de ${format(targetDate, 'dd/MM/yyyy')}? Após a exclusão, não será possível recuperar estes dados.`
    );
    if (!confirmed) return;
    await deleteSession(workoutQuery.data.sessionId);
    setSets([]);
    setCompletedAt(null);
    queryClient.invalidateQueries({ queryKey: ['daily-workout', planId, dateKey] });
    queryClient.invalidateQueries({ queryKey: ['exercise-progress'] });
  }

  // Dia futuro (um dos 7 dias à frente de hoje) nunca é editável — não dá
  // pra preencher séries de um treino que ainda não aconteceu.
  const isFutureDay = dateOffset > 0;
  const isLocked = completedAt != null || isFutureDay;

  // Se o plano (ou o exercício dentro dele) for excluído depois que a
  // série já existia, plan_exercise_id vira null (on delete set null) —
  // pra um treino já concluído/travado isso não pode fazer a série
  // "sumir" da tela, então cai pra agrupar por exercise_id (estável,
  // exercícios não são apagados junto com o plano).
  const setsByExercise = useMemo(() => {
    const exerciseIdToPlanExerciseId = new Map<number, number>();
    for (const pe of workoutQuery.data?.planExercises ?? []) {
      exerciseIdToPlanExerciseId.set(pe.exercise_id, pe.id);
    }

    const map = new Map<number, SessionSet[]>();
    for (const set of sets) {
      const key = set.plan_exercise_id ?? exerciseIdToPlanExerciseId.get(set.exercise_id);
      if (key == null) continue;
      const list = map.get(key) ?? [];
      list.push(set);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.set_number - b.set_number);
    return map;
  }, [sets, workoutQuery.data?.planExercises]);

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

  return (
    <div className="daily-workout">
      <div className="workout-top">
        <div>
          <span className="workout-eyebrow">
            Treino do{' '}
            {dateOffset === 0 ? (
              'dia'
            ) : (
              <button type="button" className="workout-eyebrow-link" onClick={() => setDateOffset(0)}>
                dia
              </button>
            )}
          </span>
          <div className="workout-day-nav">
            <button
              type="button"
              className="day-nav-btn"
              onClick={() => setDateOffset((o) => Math.max(o - 1, -MAX_DAYS_BACK))}
              disabled={dateOffset <= -MAX_DAYS_BACK}
              aria-label="Dia anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <h1>{dayLabel(dateOffset, targetDate)}</h1>
            <button
              type="button"
              className="day-nav-btn"
              onClick={() => setDateOffset((o) => Math.min(o + 1, MAX_DAYS_FORWARD))}
              disabled={dateOffset >= MAX_DAYS_FORWARD}
              aria-label="Próximo dia"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {(workoutQuery.data?.planName || scheduleQuery.data?.plan_name) && (
            <p className="workout-plan-label">
              Plano selecionado para o dia:{' '}
              <strong>{workoutQuery.data?.planName ?? scheduleQuery.data?.plan_name}</strong>
            </p>
          )}
        </div>
        {sets.length > 0 && <ProgressRing percent={progressPercent} />}
      </div>

      {isFutureDay && workoutQuery.data && (
        <p className="offline-banner">
          Este treino ainda não aconteceu — os campos ficam disponíveis pra preenchimento só a partir do dia.
        </p>
      )}

      {(isOffline || queuedCount > 0) && (
        <p className="offline-banner">
          {isOffline
            ? `Você está offline — as alterações serão salvas quando a conexão voltar${queuedCount > 0 ? ` (${queuedCount} pendente${queuedCount > 1 ? 's' : ''})` : ''}.`
            : `Sincronizando ${queuedCount} alteração${queuedCount > 1 ? 'ões' : ''} pendente${queuedCount > 1 ? 's' : ''}...`}
        </p>
      )}

      {(scheduleQuery.isLoading || dateSessionQuery.isLoading) && <p className="workout-status">Carregando...</p>}

      {hasNoWorkout && (
        <EmptyState
          icon={<CalendarOff size={34} />}
          title={dateOffset === 0 ? 'Nenhum treino agendado para hoje' : 'Nenhum treino agendado para este dia'}
          description={
            IS_ANDROID
              ? 'Configure sua agenda semanal pela versão web em Configuração → Meu Treino.'
              : 'Configure sua agenda semanal em Configuração → Meu Treino para escolher qual plano treinar em cada dia.'
          }
          {...(!IS_ANDROID &&
            dateOffset >= 0 && { actionLabel: 'Configurar Meu Treino', actionTo: '/admin/schedule' })}
        />
      )}

      {workoutQuery.isLoading && <p className="workout-status">Carregando treino do dia...</p>}
      {workoutQuery.isError && <p className="workout-error">Erro ao carregar o treino.</p>}

      {workoutQuery.data && workoutQuery.data.planExercises.length === 0 && (
        <p className="workout-status">Este plano ainda não tem exercícios cadastrados.</p>
      )}

      {workoutQuery.data && workoutQuery.data.planExercises.length > 0 && (
        <div className="exercise-list">
          {workoutQuery.data.planExercises.map((pe) => (
            <div key={pe.id} className="exercise-card">
              <div className="exercise-header">
                <h3>{pe.exercise_name}</h3>
                {pe.muscle_group && <span className="muscle-group">{pe.muscle_group}</span>}
                <a
                  className="video-link"
                  href={youtubeSearchUrl(`${pe.exercise_name} execução correta`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver vídeo de ${pe.exercise_name} no YouTube`}
                >
                  <PlayCircle size={15} />
                  Vídeo
                </a>
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
                  {(setsByExercise.get(pe.id) ?? []).map((set) => {
                    const canComplete = set.reps != null && set.weight_kg != null && set.duration_seconds != null;
                    return (
                      <tr key={set.id} className={set.completed ? 'completed' : ''}>
                        <td>
                          <span className="set-number">{set.set_number}</span>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            defaultValue={set.reps ?? ''}
                            disabled={isLocked}
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
                            disabled={isLocked}
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
                            disabled={isLocked}
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
                            disabled={isLocked || (!set.completed && !canComplete)}
                            title={
                              !canComplete && !set.completed
                                ? 'Preencha reps, peso e tempo antes de concluir'
                                : undefined
                            }
                            onClick={() => persist(set.id, { completed: !set.completed })}
                          >
                            ✓
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {workoutQuery.data && workoutQuery.data.planExercises.length > 0 && !isFutureDay && (
        <div className="workout-complete-bar">
          {completedAt ? (
            <div className="workout-complete-status">
              <p className="workout-complete-done">
                <CheckCircle2 size={17} />
                Treino concluído às {format(new Date(completedAt), 'HH:mm')}
              </p>
              <button type="button" className="reopen-btn" onClick={handleReopenDay}>
                <RotateCcw size={15} />
                Reabrir treino
              </button>
              <button type="button" className="delete-day-btn" onClick={handleDeleteDay}>
                <Trash2 size={13} />
                Excluir treino
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="complete-day-btn"
              onClick={handleCompleteDay}
              disabled={progressPercent === 0}
              title={progressPercent === 0 ? 'Marque ao menos uma série como feita para encerrar o dia' : undefined}
            >
              <Flag size={16} />
              Concluir treino do dia
            </button>
          )}
        </div>
      )}
    </div>
  );
}
