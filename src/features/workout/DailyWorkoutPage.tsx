import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  Medal,
  PlayCircle,
  RotateCcw,
  Star,
  Trash2,
  Trophy,
} from 'lucide-react';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '../../components/EmptyState';
import { ProgressRing } from '../../components/ProgressRing';
import { medalTierForPercent } from '../../lib/medal';
import {
  cancelSessionForDate,
  completeSession,
  createSession,
  deleteSession,
  fetchActivePlans,
  fetchBestEstimated1RM,
  fetchLastUsedValues,
  fetchPreviousExerciseSetups,
  fetchScheduledPlanForDate,
  fetchSessionForDate,
  loadDailyWorkout,
  reopenSession,
  updateExerciseNote,
  updateSessionSet,
} from './api';
import { estimateOneRepMax, suggestedLoadsForOneRepMax } from './oneRepMax';
import { fetchWeeklySchedule } from '../scheduleApi';
import { enqueuePatch, flushQueue, getQueuedCount } from './offlineQueue';
import type { MetricType, PlanExercise, SessionSet, SessionSetPatch } from './types';
import { youtubeSearchUrl } from '../../lib/youtube';
import './DailyWorkoutPage.css';

const MAX_DAYS_BACK = 30;
const MAX_DAYS_FORWARD = 7;

type SetFieldKey = keyof Pick<
  SessionSet,
  'reps' | 'weight_kg' | 'duration_seconds' | 'distance_km' | 'incline_degree' | 'calories'
>;

interface SetFieldConfig {
  key: SetFieldKey;
  label: string;
  step?: string;
  toInputValue: (value: number | null) => number | string;
  fromInputValue: (raw: string) => number | null;
}

const numberField = (key: SetFieldKey, label: string, step?: string): SetFieldConfig => ({
  key,
  label,
  step,
  toInputValue: (value) => value ?? '',
  fromInputValue: (raw) => (raw === '' ? null : Number(raw)),
});

const STRENGTH_FIELDS: SetFieldConfig[] = [
  numberField('reps', 'Reps'),
  numberField('weight_kg', 'Peso (kg)', '0.5'),
  numberField('duration_seconds', 'Tempo (s)'),
];

const CARDIO_FIELDS: SetFieldConfig[] = [
  {
    key: 'duration_seconds',
    label: 'Duração (min)',
    toInputValue: (value) => (value == null ? '' : value / 60),
    fromInputValue: (raw) => (raw === '' ? null : Math.round(Number(raw) * 60)),
  },
  numberField('distance_km', 'Distância (km)', '0.01'),
  numberField('incline_degree', 'Inclinação (°)', '0.5'),
  numberField('calories', 'Calorias (kcal)'),
];

function fieldsForMetricType(metricType: MetricType): SetFieldConfig[] {
  return metricType === 'cardio' ? CARDIO_FIELDS : STRENGTH_FIELDS;
}

function formatTimerClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

interface SetupValues {
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
}

// "Setup melhor" que o da última vez: reps nunca pode ter caído, e a
// métrica relevante pro exercício precisa ter de fato aumentado — peso,
// se for exercício de peso (tem peso no setup anterior), ou tempo, se for
// de tempo (isométrico, sem peso no setup anterior, ex. prancha).
function isBetterSetup(previous: SetupValues, next: SetupValues): boolean {
  if (previous.reps != null && (next.reps == null || next.reps < previous.reps)) return false;

  if (previous.weight_kg != null) {
    return next.weight_kg != null && next.weight_kg > previous.weight_kg;
  }
  if (previous.duration_seconds != null) {
    return next.duration_seconds != null && next.duration_seconds > previous.duration_seconds;
  }
  return false;
}

// Calculadora de 1RM por exercício — estado próprio (peso/reps digitados),
// só se apoia no 1RM já conhecido do exercício (histórico/sessão) como
// referência quando o usuário ainda não calculou nada na hora.
function OneRepMaxCalculator({ bestOneRepMax }: { bestOneRepMax?: number }) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const typedEstimate = weight !== '' && reps !== '' ? estimateOneRepMax(Number(weight), Number(reps)) : null;
  const reference = typedEstimate ?? bestOneRepMax ?? null;

  return (
    <details className="one-rm-calculator">
      <summary>🧮 Calculadora de 1RM</summary>
      <div className="one-rm-calculator-body">
        {bestOneRepMax != null && (
          <p className="one-rm-best">Seu 1RM estimado atual: ~{bestOneRepMax.toFixed(1)}kg</p>
        )}
        <div className="one-rm-inputs">
          <input
            type="number"
            min={0}
            step="0.5"
            placeholder="Peso (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <input type="number" min={0} placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} />
        </div>
        {typedEstimate != null && <p className="one-rm-result">1RM estimado: ~{typedEstimate.toFixed(1)}kg</p>}
        {reference != null && (
          <table className="one-rm-table">
            <thead>
              <tr>
                <th>%</th>
                <th>Carga sugerida</th>
              </tr>
            </thead>
            <tbody>
              {suggestedLoadsForOneRepMax(reference).map((row) => (
                <tr key={row.percentage}>
                  <td>{row.percentage}%</td>
                  <td>{row.weightKg}kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}

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
  // Só cai pro plano da agenda depois que dateSessionQuery realmente
  // resolveu (não só "ainda não chegou") — senão, se scheduleQuery
  // terminar primeiro por sorte de rede, workoutQuery dispara cedo demais
  // sem sessão conhecida e loadDailyWorkout acaba buscando ela nesse
  // (perdendo o ganho de reaproveitar essa consulta, ver loadDailyWorkout).
  // Sessão cancelada conta como se não tivesse plano nenhum, mesmo que a
  // agenda semanal (ou um treino avulso anterior) diga o contrário — o dia
  // volta a se comportar como vazio (Treino avulso disponível de novo).
  const isSessionCanceled = dateSessionQuery.data?.canceled_at != null;
  const planId =
    dateSessionQuery.data !== undefined
      ? isSessionCanceled
        ? null
        : dateSessionQuery.data?.plan_id ?? scheduleQuery.data?.plan_id ?? null
      : null;
  const hasNoWorkout =
    !dateSessionQuery.isLoading &&
    !scheduleQuery.isLoading &&
    (isSessionCanceled || (!dateSessionQuery.data && !scheduleQuery.data));

  const workoutQuery = useQuery({
    queryKey: ['daily-workout', dateKey],
    // dateSessionQuery já buscou a sessão dessa data pra descobrir o
    // planId acima — repassar o resultado evita loadDailyWorkout buscar
    // a mesma sessão de novo (era a maior causa da demora pra abrir a tela).
    queryFn: () => loadDailyWorkout(planId!, targetDate, dateSessionQuery.data),
    enabled: planId != null,
  });

  // Reaproveitar os números do último treino só faz sentido pro dia de
  // hoje, enquanto ele ainda está em aberto — dias passados são histórico
  // (imutável) e dias futuros nem têm os campos liberados pra edição.
  const isTodayLive = dateOffset === 0 && workoutQuery.data != null && workoutQuery.data.completedAt == null;
  const planExerciseIdsKey = workoutQuery.data?.planExercises.map((pe) => pe.id).join(',') ?? '';
  const lastUsedQuery = useQuery({
    queryKey: ['last-used-values', dateKey, planExerciseIdsKey],
    queryFn: () => fetchLastUsedValues(workoutQuery.data!.planExercises, dateKey),
    enabled: isTodayLive,
  });

  const queryClient = useQueryClient();

  // Antecipar/cancelar um dia muda o que a Home mostra pra essa data (o
  // card "Treino do dia" e o calendário) — sem isso, a Home só pegava os
  // dados novos num refetch por sorte (foco de janela etc.), não na hora.
  function invalidateHomeQueries() {
    queryClient.invalidateQueries({ queryKey: ['month-progress'] });
    queryClient.invalidateQueries({ queryKey: ['today-session-status'] });
    queryClient.invalidateQueries({ queryKey: ['effective-plan'] });
  }

  // Treino avulso: só pra um dia vazio (sem plano agendado), hoje ou um
  // dia futuro navegado antecipadamente — nunca pra dia passado (histórico
  // não faz sentido "antecipar"). Não altera workout_weekly_schedule, só
  // cria a sessão desse dia já com o plano escolhido.
  const canPickAdHocPlan = hasNoWorkout && dateOffset >= 0;
  const weeklyScheduleQuery = useQuery({
    queryKey: ['weekly-schedule'],
    queryFn: fetchWeeklySchedule,
    enabled: canPickAdHocPlan,
  });
  const activePlansQuery = useQuery({
    queryKey: ['active-plans'],
    queryFn: fetchActivePlans,
    enabled: canPickAdHocPlan,
  });

  // Sugestão de 1 clique: planos já agendados pros próximos dias da
  // semana, na ordem em que vão acontecer — reaproveita o mesmo dayLabel
  // da navegação normal ("Amanhã", "Sexta, 28/11"...).
  const upcomingPlanSuggestions = useMemo(() => {
    if (!weeklyScheduleQuery.data) return [];
    const scheduleByDayOfWeek = new Map(weeklyScheduleQuery.data.map((day) => [day.day_of_week, day]));
    const suggestions: { dateLabel: string; planId: number; planName: string }[] = [];
    for (let offset = 1; offset <= MAX_DAYS_FORWARD; offset++) {
      const date = addDays(new Date(), offset);
      const scheduled = scheduleByDayOfWeek.get(date.getDay());
      if (!scheduled) continue;
      suggestions.push({ dateLabel: dayLabel(offset, date), planId: scheduled.plan_id, planName: scheduled.plan_name });
    }
    return suggestions;
  }, [weeklyScheduleQuery.data]);

  const [otherPlanId, setOtherPlanId] = useState('');
  const [isCreatingAdHocSession, setIsCreatingAdHocSession] = useState(false);

  async function handlePickAdHocPlan(adHocPlanId: number) {
    setIsCreatingAdHocSession(true);
    try {
      await createSession(adHocPlanId, dateKey);
      await queryClient.invalidateQueries({ queryKey: ['session-for-date', dateKey] });
      await queryClient.invalidateQueries({ queryKey: ['daily-workout', dateKey] });
      invalidateHomeQueries();
    } finally {
      setIsCreatingAdHocSession(false);
    }
  }

  // Timer de descanso entre séries — só visual/local, não persiste nada.
  // Avança sozinho via setTimeout encadeado pelo próprio estado; ao chegar
  // a 0, vibra (se suportado) e desaparece sozinho depois de alguns segundos.
  const [restTimer, setRestTimer] = useState<{ exerciseName: string; secondsLeft: number } | null>(null);

  useEffect(() => {
    if (!restTimer) return;
    if (restTimer.secondsLeft <= 0) {
      navigator.vibrate?.([200, 100, 200]);
      const dismissId = setTimeout(() => setRestTimer(null), 3000);
      return () => clearTimeout(dismissId);
    }
    const tickId = setTimeout(() => {
      setRestTimer((prev) => (prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : prev));
    }, 1000);
    return () => clearTimeout(tickId);
  }, [restTimer]);

  function startRestTimer(exerciseName: string, totalSeconds: number) {
    if (totalSeconds <= 0) return;
    setRestTimer({ exerciseName, secondsLeft: totalSeconds });
  }

  // Detecção de PR: 1RM estimado (Epley) de cada série concluída, comparado
  // contra o maior já visto pro exercício — carregado 1x do histórico e
  // mantido num estado local que já vai sendo atualizado a cada PR batido
  // ainda dentro da mesma visita (pra a 2ª série já comparar com a 1ª).
  const strengthExerciseIds = useMemo(
    () =>
      (workoutQuery.data?.planExercises ?? [])
        .filter((pe) => pe.metric_type === 'strength')
        .map((pe) => pe.exercise_id),
    [workoutQuery.data?.planExercises]
  );
  const bestOneRmQuery = useQuery({
    queryKey: ['best-one-rm', strengthExerciseIds.join(',')],
    queryFn: () => fetchBestEstimated1RM(strengthExerciseIds),
    enabled: strengthExerciseIds.length > 0,
  });
  const [sessionBestOneRm, setSessionBestOneRm] = useState<Map<number, number>>(new Map());
  useEffect(() => {
    if (bestOneRmQuery.data) setSessionBestOneRm(new Map(bestOneRmQuery.data));
  }, [bestOneRmQuery.data]);

  const [prToast, setPrToast] = useState<string | null>(null);
  useEffect(() => {
    if (!prToast) return;
    const id = setTimeout(() => setPrToast(null), 5000);
    return () => clearTimeout(id);
  }, [prToast]);

  function checkForPersonalRecord(exerciseId: number, exerciseName: string, weightKg: number, reps: number) {
    const estimate = estimateOneRepMax(weightKg, reps);
    const previousBest = sessionBestOneRm.get(exerciseId) ?? 0;
    if (estimate <= previousBest) return;
    setSessionBestOneRm((prev) => new Map(prev).set(exerciseId, estimate));
    setPrToast(`🏆 Novo PR em ${exerciseName}: ~${estimate.toFixed(1)}kg (1RM estimado)`);
  }

  // "Setup" (reps x peso x tempo) da última vez que cada exercício foi
  // feito — comparado contra a última série de hoje, só ao finalizar o
  // exercício (ver isBetterSetup). Só carrega pro dia de hoje em aberto,
  // mesmo critério de isTodayLive usado pro resto da página.
  const previousSetupsQuery = useQuery({
    queryKey: ['previous-setups', dateKey, strengthExerciseIds.join(',')],
    queryFn: () => fetchPreviousExerciseSetups(strengthExerciseIds, dateKey),
    enabled: isTodayLive && strengthExerciseIds.length > 0,
  });

  function handleToggleSetComplete(set: SessionSet, pe: PlanExercise, isLastSetOfExercise: boolean) {
    const completing = !set.completed;
    const patch: SessionSetPatch = { completed: completing };

    if (isLastSetOfExercise && pe.metric_type === 'strength') {
      const previousSetup = previousSetupsQuery.data?.get(pe.exercise_id);
      patch.is_record =
        completing &&
        previousSetup != null &&
        isBetterSetup(previousSetup, {
          reps: set.reps,
          weight_kg: set.weight_kg,
          duration_seconds: set.duration_seconds,
        });
    }

    persist(set.id, patch);
    if (!completing) return;

    if (!isLastSetOfExercise) startRestTimer(pe.exercise_name, pe.rest_seconds);
    if (pe.metric_type === 'strength' && set.reps != null && set.weight_kg != null) {
      checkForPersonalRecord(pe.exercise_id, pe.exercise_name, set.weight_kg, set.reps);
    }
  }

  const [sets, setSets] = useState<SessionSet[]>([]);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [exerciseNotes, setExerciseNotes] = useState<Record<number, string>>({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(() => getQueuedCount());

  useEffect(() => {
    setSets([]);
    setCompletedAt(null);
    setExerciseNotes({});
  }, [dateOffset]);

  useEffect(() => {
    if (workoutQuery.data) {
      setSets(workoutQuery.data.sets);
      setCompletedAt(workoutQuery.data.completedAt);
      setExerciseNotes(workoutQuery.data.exerciseNotes);
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

  // Cancela o treino de um dia futuro específico — não altera a agenda
  // semanal nem um treino avulso de outro dia, só esse dia volta a ficar
  // vazio (e o Treino avulso passa a estar disponível nele de novo).
  async function handleCancelDay() {
    const confirmed = window.confirm(
      `Cancelar o treino de ${format(targetDate, 'dd/MM/yyyy')}? Isso não altera sua agenda semanal — só este dia fica sem treino (você pode escolher outro depois, se quiser).`
    );
    if (!confirmed) return;
    await cancelSessionForDate(dateKey, dateSessionQuery.data?.id ?? null);
    await queryClient.invalidateQueries({ queryKey: ['session-for-date', dateKey] });
    await queryClient.invalidateQueries({ queryKey: ['daily-workout', dateKey] });
    invalidateHomeQueries();
  }

  // Dia futuro (um dos 7 dias à frente de hoje) nunca é editável — não dá
  // pra preencher séries de um treino que ainda não aconteceu.
  const isFutureDay = dateOffset > 0;
  const isLocked = completedAt != null || isFutureDay;

  // Calculadora de 1RM só faz sentido pra treino ainda em aberto — hoje
  // (enquanto não concluído) ou dias futuros. Dia passado é histórico
  // fechado, sem motivo pra recalcular nada.
  const canUseOneRepMaxCalculator = isFutureDay || (dateOffset === 0 && completedAt == null);

  // Medalha motivacional ao lado do círculo de progresso — nunca em dia
  // futuro (sem nada realizado ainda pra premiar).
  const progressMedalTier = isFutureDay ? null : medalTierForPercent(progressPercent);

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

  async function persistNote(planExerciseId: number, note: string) {
    if (!workoutQuery.data) return;
    setExerciseNotes((prev) => ({ ...prev, [planExerciseId]: note }));
    try {
      await updateExerciseNote(workoutQuery.data.sessionId, planExerciseId, note);
    } catch {
      // Sem fila offline pra comentários (baixo risco, ver reps/peso/tempo
      // acima) — o valor digitado fica preservado na tela e uma nova
      // tentativa de salvar (outro blur, ou reabrir o dia) tenta de novo.
    }
  }

  return (
    <div className="daily-workout">
      {restTimer && (
        <div className="rest-timer-bar">
          <span className="rest-timer-label">
            {restTimer.secondsLeft > 0 ? `Descanso — ${restTimer.exerciseName}` : 'Descanso concluído'}
          </span>
          <span className="rest-timer-countdown">
            {restTimer.secondsLeft > 0 ? formatTimerClock(restTimer.secondsLeft) : '✓'}
          </span>
          {restTimer.secondsLeft > 0 && (
            <button type="button" className="rest-timer-skip" onClick={() => setRestTimer(null)}>
              Pular
            </button>
          )}
        </div>
      )}

      {prToast && <div className="pr-toast">{prToast}</div>}

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
        {sets.length > 0 && (
          <div className="workout-progress-wrap">
            <ProgressRing percent={progressPercent} />
            {progressMedalTier && <Medal size={30} className={`workout-progress-medal medal-${progressMedalTier}`} />}
          </div>
        )}
      </div>

      {isFutureDay && !hasNoWorkout && workoutQuery.data && (
        <div className="future-day-banner">
          <p className="offline-banner">
            Este treino ainda não aconteceu — os campos ficam disponíveis pra preenchimento só a partir do dia.
          </p>
          <button type="button" className="cancel-future-day-btn" onClick={handleCancelDay}>
            Cancelar treino deste dia
          </button>
        </div>
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

      {canPickAdHocPlan && (upcomingPlanSuggestions.length > 0 || (activePlansQuery.data?.length ?? 0) > 0) && (
        <div className="adhoc-session">
          <span className="adhoc-session-eyebrow">Treino avulso</span>

          {upcomingPlanSuggestions.length > 0 && (
            <>
              <p className="adhoc-hint">Antecipar um treino dos próximos dias:</p>
              <div className="adhoc-suggestions">
                {upcomingPlanSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.dateLabel}-${index}`}
                    type="button"
                    className="adhoc-suggestion-btn"
                    disabled={isCreatingAdHocSession}
                    onClick={() => handlePickAdHocPlan(suggestion.planId)}
                  >
                    Antecipar {suggestion.dateLabel} — {suggestion.planName}
                  </button>
                ))}
              </div>
            </>
          )}

          {(activePlansQuery.data?.length ?? 0) > 0 && (
            <details className="adhoc-other-plan">
              <summary>Ou escolher outro plano</summary>
              <div className="adhoc-other-plan-picker">
                <select
                  value={otherPlanId}
                  onChange={(e) => setOtherPlanId(e.target.value)}
                  disabled={isCreatingAdHocSession}
                >
                  <option value="">Selecione um plano</option>
                  {activePlansQuery.data?.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!otherPlanId || isCreatingAdHocSession}
                  onClick={() => handlePickAdHocPlan(Number(otherPlanId))}
                >
                  Usar este plano
                </button>
              </div>
            </details>
          )}

          <p className="adhoc-session-note">
            Vale só pra {dateOffset === 0 ? 'hoje' : 'este dia'} — sua agenda semanal continua igual.
          </p>
        </div>
      )}

      {workoutQuery.isLoading && <p className="workout-status">Carregando treino do dia...</p>}
      {workoutQuery.isError && <p className="workout-error">Erro ao carregar o treino.</p>}

      {!hasNoWorkout && workoutQuery.data && workoutQuery.data.planExercises.length === 0 && (
        <p className="workout-status">Este plano ainda não tem exercícios cadastrados.</p>
      )}

      {!hasNoWorkout && workoutQuery.data && workoutQuery.data.planExercises.length > 0 && (
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
                {(setsByExercise.get(pe.id) ?? []).some((s) => s.is_record) && (
                  <Trophy
                    size={16}
                    className="exercise-record-icon medal-gold"
                    aria-label="Novo recorde de reps/peso/tempo neste exercício"
                  />
                )}
              </div>
              {pe.target_reps && <p className="target-reps">Alvo: {pe.target_reps} reps</p>}

              {(() => {
                const fields = fieldsForMetricType(pe.metric_type ?? 'strength');
                const exerciseSets = setsByExercise.get(pe.id) ?? [];
                return (
                  <table className="sets-table">
                    <thead>
                      <tr>
                        <th>Série</th>
                        {fields.map((field) => (
                          <th key={field.key}>{field.label}</th>
                        ))}
                        <th>Feito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exerciseSets.map((set, setIndex) => {
                        const isLastSetOfExercise = setIndex === exerciseSets.length - 1;
                        // Sempre o setup (última série) da execução mais
                        // recente desse exercício, igual pra todas as
                        // séries de hoje — não por número de série (ver
                        // fetchLastUsedValues).
                        const suggestion = isTodayLive
                          ? lastUsedQuery.data?.setValues.get(set.exercise_id)
                          : undefined;
                        // Exige que o usuário tenha clicado em cada campo (o
                        // que já persiste o valor, sugerido ou não, e troca a
                        // cor de marca d'água pra cor real) antes de liberar
                        // o Feito — ele precisa ter visto/confirmado os
                        // números, não só aceitado às cegas o que foi
                        // reaproveitado do último treino.
                        const canComplete = fields.every((field) => set[field.key] != null);
                        return (
                          <tr key={set.id} className={set.completed ? 'completed' : ''}>
                            <td>
                              {isLastSetOfExercise ? (
                                <span
                                  className="set-number set-number-final"
                                  title="Última série — fecha o setup de hoje deste exercício"
                                >
                                  <Star size={28} className="set-number-final-star" />
                                  <span className="set-number-final-value">{set.set_number}</span>
                                </span>
                              ) : (
                                <span className="set-number">{set.set_number}</span>
                              )}
                            </td>
                            {fields.map((field) => {
                              const hasRealValue = set[field.key] != null;
                              const isSuggested = !hasRealValue && suggestion?.[field.key] != null;
                              const displayValue = hasRealValue ? set[field.key] : isSuggested ? suggestion![field.key]! : null;
                              return (
                                <td key={field.key}>
                                  <input
                                    type="number"
                                    min={0}
                                    step={field.step}
                                    defaultValue={field.toInputValue(displayValue)}
                                    disabled={isLocked}
                                    className={isSuggested ? 'suggested-value' : undefined}
                                    onFocus={
                                      isSuggested
                                        ? (e) => e.currentTarget.classList.remove('suggested-value')
                                        : undefined
                                    }
                                    onBlur={(e) =>
                                      persist(set.id, {
                                        [field.key]: field.fromInputValue(e.target.value),
                                      } as SessionSetPatch)
                                    }
                                  />
                                </td>
                              );
                            })}
                            <td>
                              <button
                                type="button"
                                className={`check-btn ${set.completed ? 'checked' : ''}`}
                                aria-pressed={set.completed}
                                aria-label={set.completed ? 'Marcar como não concluída' : 'Marcar como concluída'}
                                disabled={isLocked || (!set.completed && !canComplete)}
                                title={
                                  !canComplete && !set.completed
                                    ? `Preencha ${fields.map((f) => f.label).join(', ')} antes de concluir`
                                    : undefined
                                }
                                onClick={() => handleToggleSetComplete(set, pe, isLastSetOfExercise)}
                              >
                                ✓
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}

              {pe.metric_type === 'strength' && canUseOneRepMaxCalculator && (
                <OneRepMaxCalculator bestOneRepMax={sessionBestOneRm.get(pe.exercise_id)} />
              )}

              {(() => {
                const noteValue = exerciseNotes[pe.id];
                const noteSuggestion = isTodayLive ? lastUsedQuery.data?.notes[pe.id] : undefined;
                const isNoteSuggested = !noteValue && !!noteSuggestion;
                return (
                  <label className="exercise-note">
                    <span>Comentários</span>
                    <textarea
                      placeholder="Alguma observação sobre este exercício hoje?"
                      defaultValue={noteValue ?? noteSuggestion ?? ''}
                      disabled={isLocked}
                      className={isNoteSuggested ? 'suggested-value' : undefined}
                      onFocus={
                        isNoteSuggested ? (e) => e.currentTarget.classList.remove('suggested-value') : undefined
                      }
                      onBlur={(e) => {
                        if (e.target.value !== (exerciseNotes[pe.id] ?? '')) persistNote(pe.id, e.target.value);
                      }}
                    />
                  </label>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {!hasNoWorkout && workoutQuery.data && workoutQuery.data.planExercises.length > 0 && !isFutureDay && (
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
