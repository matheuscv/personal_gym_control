import { format } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { estimateOneRepMax } from './oneRepMax';
import type {
  DailyWorkout,
  PlanExercise,
  SessionSet,
  SessionSetPatch,
  WorkoutPlan,
  WorkoutSummaryInput,
} from './types';

export async function fetchActivePlans(): Promise<WorkoutPlan[]> {
  const { data, error } = await supabase
    .from('workout_plans')
    .select('id, name, is_active')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name');

  if (error) throw error;
  return data;
}

interface ScheduleForDateRow {
  plan_id: number;
  workout_plans: { name: string } | null;
}

export async function fetchScheduledPlanForDate(
  date: Date
): Promise<{ plan_id: number; plan_name: string } | null> {
  const dayOfWeek = date.getDay();
  const { data, error } = await supabase
    .from('workout_weekly_schedule')
    .select('plan_id, workout_plans (name)')
    .eq('day_of_week', dayOfWeek)
    .maybeSingle<ScheduleForDateRow>();
  if (error) throw error;
  if (!data) return null;
  return { plan_id: data.plan_id, plan_name: data.workout_plans?.name ?? 'Plano' };
}

interface PlanExerciseRow {
  id: number;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  rest_seconds: number;
  exercise_id: number;
  exercises: { name: string; muscle_group: string | null; metric_type: 'strength' | 'cardio' } | null;
}

export interface SessionRow {
  id: number;
  plan_id: number | null;
  completed_at: string | null;
  canceled_at: string | null;
  locked_plan_exercises: PlanExercise[] | null;
  duration_minutes: number | null;
  calories: number | null;
  heart_rate_avg: number | null;
  heart_rate_max: number | null;
  mood: WorkoutSummaryInput['mood'];
}

const SESSION_COLUMNS =
  'id, plan_id, completed_at, canceled_at, locked_plan_exercises, duration_minutes, calories, heart_rate_avg, heart_rate_max, mood';

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

async function fetchPlanName(planId: number): Promise<string> {
  const { data, error } = await supabase
    .from('workout_plans')
    .select('name')
    .eq('id', planId)
    .maybeSingle<{ name: string }>();
  if (error) throw error;
  return data?.name ?? 'Plano removido';
}

// Lista de exercícios do plano tal como está agora — usada tanto pro
// caminho "ao vivo" (sessão de hoje ainda em aberto) quanto pra capturar
// o snapshot que trava uma sessão.
async function fetchLivePlanExercises(planId: number): Promise<PlanExercise[]> {
  const { data: planExerciseRows, error } = await supabase
    .from('workout_plan_exercises')
    .select(
      'id, order_index, target_sets, target_reps, rest_seconds, exercise_id, exercises (name, muscle_group, metric_type)'
    )
    .eq('plan_id', planId)
    .is('deleted_at', null)
    .order('order_index')
    .returns<PlanExerciseRow[]>();
  if (error) throw error;

  return (planExerciseRows ?? []).map((row) => ({
    id: row.id,
    order_index: row.order_index,
    target_sets: row.target_sets,
    target_reps: row.target_reps,
    rest_seconds: row.rest_seconds,
    exercise_id: row.exercise_id,
    exercise_name: row.exercises?.name ?? '(exercício removido)',
    muscle_group: row.exercises?.muscle_group ?? null,
    metric_type: row.exercises?.metric_type ?? 'strength',
  }));
}

// Uma data tem no máximo uma sessão, independente de qual plano está
// agendado hoje pra esse dia da semana — buscar por plan_id+data faria
// uma troca na agenda "perder" a sessão antiga (e criar uma segunda pra
// mesma data). .limit(1) em vez de .maybeSingle() por segurança, caso
// ainda exista alguma duplicata de antes dessa correção.
async function findSessionForDate(dateStr: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(SESSION_COLUMNS)
    .eq('session_date', dateStr)
    .order('id', { ascending: true })
    .limit(1)
    .returns<SessionRow[]>();
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

// Exportada também pra criação de treino avulso (Treino do dia, dia sem
// plano agendado) — mesmo caminho de um dia novo normal, só que com o
// plano escolhido na hora pelo usuário em vez do que está na agenda
// semanal. Não toca em workout_weekly_schedule, então é só daquele dia.
//
// Idempotente por data: se já existe uma sessão pra esse dia (cancelada,
// por exemplo — reantecipar depois de cancelar), reaproveita a linha em
// vez de inserir uma segunda. Sem isso, a data acabava com 2 sessões e
// findSessionForDate (que pega a mais antiga) continuava enxergando a
// cancelada, ignorando a nova escolha.
export async function createSession(scheduledPlanId: number, dateStr: string): Promise<SessionRow> {
  // Sessão criada pra uma data que já passou (ex.: primeira vez que se
  // visita um dia antigo) já nasce travada — editar o plano depois não
  // deve alterar a visão desse dia.
  const lockedPlanExercises = dateStr < todayStr() ? await fetchLivePlanExercises(scheduledPlanId) : null;

  const existing = await findSessionForDate(dateStr);
  if (existing) {
    const { data: updatedSession, error: updateError } = await supabase
      .from('workout_sessions')
      .update({ plan_id: scheduledPlanId, canceled_at: null, locked_plan_exercises: lockedPlanExercises })
      .eq('id', existing.id)
      .select(SESSION_COLUMNS)
      .single<SessionRow>();
    if (updateError) throw updateError;
    return updatedSession;
  }

  // upsert (não insert puro) por segurança contra corrida com outra
  // chamada concorrente resolvendo a mesma data ao mesmo tempo — a
  // constraint única em (owner_id, session_date) garante que só sobra
  // uma linha de qualquer forma, mas upsert evita até o erro de conflito.
  const { data: newSession, error: sessionInsertError } = await supabase
    .from('workout_sessions')
    .upsert(
      { plan_id: scheduledPlanId, session_date: dateStr, locked_plan_exercises: lockedPlanExercises, canceled_at: null },
      { onConflict: 'owner_id,session_date' }
    )
    .select(SESSION_COLUMNS)
    .single<SessionRow>();
  if (sessionInsertError) throw sessionInsertError;
  return newSession;
}

// Cancela o treino de uma data específica sem tocar na agenda semanal —
// se já existe sessão pra esse dia (agendada ou avulsa), só marca
// canceled_at nela; senão cria uma sessão só com o cancelamento, sem
// plano. O dia volta a se comportar como "vazio" (Treino avulso disponível
// de novo) — ver hasNoWorkout em DailyWorkoutPage.
export async function cancelSessionForDate(dateStr: string, existingSessionId: number | null): Promise<void> {
  if (existingSessionId != null) {
    const { error } = await supabase
      .from('workout_sessions')
      .update({ canceled_at: new Date().toISOString() })
      .eq('id', existingSessionId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('workout_sessions')
    .upsert(
      { session_date: dateStr, canceled_at: new Date().toISOString() },
      { onConflict: 'owner_id,session_date' }
    );
  if (error) throw error;
}

// knownSession, quando informado (já veio de fetchSessionForDate na
// tela), evita repetir a mesma busca por data aqui dentro — é o que mais
// pesava no tempo de abertura de Treino do dia, já que rodava de novo a
// cada abertura mesmo a tela já tendo acabado de buscar isso.
async function resolveSession(
  scheduledPlanId: number,
  dateStr: string,
  knownSession?: SessionRow | null
): Promise<SessionRow> {
  const existing = knownSession !== undefined ? knownSession : await findSessionForDate(dateStr);
  return existing ?? createSession(scheduledPlanId, dateStr);
}

// Só olha se já existe sessão pra data (sem criar) — usada pra descobrir
// o plano "de fato" daquele dia antes de decidir se precisa consultar a
// agenda ao vivo (que pode ter mudado desde então), e reaproveitada por
// loadDailyWorkout (ver resolveSession) pra não buscar a mesma sessão
// duas vezes.
export async function fetchSessionForDate(dateStr: string): Promise<SessionRow | null> {
  return findSessionForDate(dateStr);
}

async function fetchExistingSets(sessionId: number): Promise<SessionSet[]> {
  const { data, error } = await supabase
    .from('workout_session_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('set_number')
    .returns<SessionSet[]>();
  if (error) throw error;
  return data ?? [];
}

async function fetchExerciseNotes(sessionId: number): Promise<Record<number, string>> {
  const { data, error } = await supabase
    .from('workout_session_exercise_notes')
    .select('plan_exercise_id, note')
    .eq('session_id', sessionId)
    .returns<{ plan_exercise_id: number; note: string | null }[]>();
  if (error) throw error;

  const exerciseNotes: Record<number, string> = {};
  for (const row of data ?? []) {
    if (row.note) exerciseNotes[row.plan_exercise_id] = row.note;
  }
  return exerciseNotes;
}

export async function loadDailyWorkout(
  scheduledPlanId: number,
  date: Date,
  knownSession?: SessionRow | null
): Promise<DailyWorkout> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const session = await resolveSession(scheduledPlanId, dateStr, knownSession);
  const sessionId = session.id;
  // Sessão já existente manda no plano de fato usado nesse dia — pode
  // divergir do agendado ao vivo se a agenda mudou depois de criada.
  const effectivePlanId = session.plan_id ?? scheduledPlanId;

  // Trava se: já tinha snapshot, o dia já passou, OU já foi concluído
  // (mesmo que hoje) — concluído é o gatilho que mais importa, é o que
  // torna o dia "história" mesmo antes de virar um dia anterior, e
  // continua travado mesmo se reaberto depois (nunca desfazemos isso).
  const wasAlreadyLocked = session.locked_plan_exercises != null;
  const isPastDate = dateStr < todayStr();
  const isLocked = wasAlreadyLocked || isPastDate || session.completed_at != null;

  // Nenhuma dessas 4 buscas depende do resultado das outras — disparadas
  // juntas em vez de uma atrás da outra, é o que mais reduz o tempo de
  // abertura da tela (de ~5 idas-e-voltas sequenciais ao banco pra 2,
  // contando a resolução da sessão acima).
  const [planExercises, planName, existingSets, exerciseNotes] = await Promise.all([
    wasAlreadyLocked ? Promise.resolve(session.locked_plan_exercises!) : fetchLivePlanExercises(effectivePlanId),
    fetchPlanName(effectivePlanId),
    fetchExistingSets(sessionId),
    fetchExerciseNotes(sessionId),
  ]);

  if (!wasAlreadyLocked && isLocked) {
    // Devia estar travada mas ainda não tinha snapshot (dia já passado,
    // ou sessão concluída antes dessa trava existir) — trava agora com o
    // melhor snapshot disponível, pra parar de acompanhar o plano vivo a
    // partir daqui.
    await supabase.from('workout_sessions').update({ locked_plan_exercises: planExercises }).eq('id', sessionId);
  }

  let liveSets = existingSets;

  // Série fantasma: exercício foi removido do plano depois que a série já
  // existia, então plan_exercise_id virou null (on delete set null) —
  // nunca mais aparece pra ser marcada (a UI agrupa por plan_exercise_id),
  // mas continuava contando pra sempre no total do percentual do dia. Só
  // faz sentido apagar numa sessão ainda viva (nunca travada) — histórico
  // travado é imutável, mesmo que tenha o mesmo problema de antes da
  // trava existir.
  if (!isLocked) {
    const orphanIds = liveSets.filter((s) => s.plan_exercise_id == null && !s.completed).map((s) => s.id);
    if (orphanIds.length > 0) {
      const { error: deleteOrphansError } = await supabase.from('workout_session_sets').delete().in('id', orphanIds);
      if (deleteOrphansError) throw deleteOrphansError;
      liveSets = liveSets.filter((s) => !orphanIds.includes(s.id));
    }
  }

  // Sessão travada (histórico) nunca tenta criar séries novas pra bater
  // com target_sets — o plano pode ter sido editado ou até excluído
  // depois, então plan_exercise_id poderia nem existir mais (violaria a
  // FK). Só a sessão ao vivo (hoje/futuro, nunca concluída) auto-completa
  // séries faltantes conforme o plano atual.
  const setsByPlanExercise = new Map<number, number>();
  for (const set of liveSets) {
    if (set.plan_exercise_id == null) continue;
    setsByPlanExercise.set(set.plan_exercise_id, (setsByPlanExercise.get(set.plan_exercise_id) ?? 0) + 1);
  }

  // "Aumentar peso no próximo treino" herdado da última execução — só
  // quando o exercício está sendo gerado do zero nessa sessão (primeira
  // vez que essas séries existem aqui), e só na última série gerada (é
  // onde esse campo vive, mesmo lugar do "setup"/is_record).
  const freshStrengthExerciseIds = isLocked
    ? []
    : planExercises
        .filter((pe) => pe.metric_type === 'strength' && (setsByPlanExercise.get(pe.id) ?? 0) === 0)
        .map((pe) => pe.exercise_id);
  const previousSetups =
    freshStrengthExerciseIds.length > 0
      ? await fetchPreviousExerciseSetups(freshStrengthExerciseIds, dateStr)
      : new Map<number, ExerciseSetup>();

  const missingSets = isLocked
    ? []
    : planExercises.flatMap((pe) => {
        const targetSets = pe.target_sets ?? 1;
        const existingCount = setsByPlanExercise.get(pe.id) ?? 0;
        const countToCreate = Math.max(0, targetSets - existingCount);
        const previousSetup = existingCount === 0 ? previousSetups.get(pe.exercise_id) : undefined;
        return Array.from({ length: countToCreate }, (_, i) => {
          const setNumber = existingCount + i + 1;
          const isLastOfFreshBatch = existingCount === 0 && setNumber === countToCreate;
          return {
            session_id: sessionId,
            exercise_id: pe.exercise_id,
            plan_exercise_id: pe.id,
            set_number: setNumber,
            increase_weight_next: isLastOfFreshBatch && previousSetup?.increase_weight_next === true,
          };
        });
      });

  let sets = liveSets;
  if (missingSets.length > 0) {
    const { data: insertedSets, error: insertSetsError } = await supabase
      .from('workout_session_sets')
      .insert(missingSets)
      .select('*')
      .returns<SessionSet[]>();
    if (insertSetsError) throw insertSetsError;
    sets = [...sets, ...(insertedSets ?? [])];
  }

  return {
    sessionId,
    completedAt: session.completed_at,
    summary: {
      duration_minutes: session.duration_minutes,
      calories: session.calories,
      heart_rate_avg: session.heart_rate_avg,
      heart_rate_max: session.heart_rate_max,
      mood: session.mood,
    },
    planId: effectivePlanId,
    planName,
    planExercises,
    sets,
    exerciseNotes,
  };
}

export interface LastUsedData {
  // Chave exercise_id (não plan_exercise_id, nem set_number) — o valor é
  // sempre o da ÚLTIMA série (maior set_number) da execução mais recente
  // desse exercício, aplicado como sugestão em TODAS as séries de hoje.
  // A última série representa o "setup" daquela execução (mesmo
  // princípio de fetchPreviousExerciseSetups) — não faz sentido misturar
  // a série 1 de uma sessão com a série 2 de outra sessão diferente.
  setValues: Map<number, SessionSetPatch>;
  notes: Record<number, string>;
}

interface RecentSessionRow {
  id: number;
  session_date: string;
  workout_session_sets: Pick<
    SessionSet,
    'exercise_id' | 'set_number' | 'reps' | 'weight_kg' | 'duration_seconds' | 'distance_km' | 'incline_degree' | 'calories'
  >[];
}

const RECENT_SESSIONS_LOOKBACK = 20;

// Pra pré-preencher o Treino do dia com os números do último treino feito
// com cada exercício — útil quando o usuário fica alguns dias sem treinar e
// não lembra onde parou. Só olha pra sessões antes de hoje, e só pelos
// exercícios do plano de hoje. A observação (nota) por exercício já é
// vinculada a plan_exercise_id, então só é resgatada quando o mesmo plano
// de hoje também foi usado na sessão anterior.
export async function fetchLastUsedValues(planExercises: PlanExercise[], todayStr: string): Promise<LastUsedData> {
  const planExerciseIds = planExercises.map((pe) => pe.id);
  const exerciseIds = new Set(planExercises.map((pe) => pe.exercise_id));

  const { data: recentSessions, error } = await supabase
    .from('workout_sessions')
    .select(
      'id, session_date, workout_session_sets (exercise_id, set_number, reps, weight_kg, duration_seconds, distance_km, incline_degree, calories)'
    )
    .lt('session_date', todayStr)
    .order('session_date', { ascending: false })
    .limit(RECENT_SESSIONS_LOOKBACK)
    .returns<RecentSessionRow[]>();
  if (error) throw error;

  const setValues = new Map<number, SessionSetPatch>();
  const remainingExerciseIds = new Set(exerciseIds);
  for (const session of recentSessions ?? []) {
    if (remainingExerciseIds.size === 0) break;
    const lastSetByExercise = new Map<number, RecentSessionRow['workout_session_sets'][number]>();
    for (const row of session.workout_session_sets ?? []) {
      if (!remainingExerciseIds.has(row.exercise_id)) continue;
      const current = lastSetByExercise.get(row.exercise_id);
      if (!current || row.set_number > current.set_number) lastSetByExercise.set(row.exercise_id, row);
    }
    for (const [exerciseId, row] of lastSetByExercise) {
      const hasData =
        row.reps != null ||
        row.weight_kg != null ||
        row.duration_seconds != null ||
        row.distance_km != null ||
        row.incline_degree != null ||
        row.calories != null;
      // Sem dado nenhum nessa (a mais recente pra esse exercício) — pode
      // ser uma série criada mas nunca preenchida; tenta uma sessão mais
      // antiga em vez de desistir desse exercício.
      if (!hasData) continue;
      setValues.set(exerciseId, {
        reps: row.reps,
        weight_kg: row.weight_kg,
        duration_seconds: row.duration_seconds,
        distance_km: row.distance_km,
        incline_degree: row.incline_degree,
        calories: row.calories,
      });
      remainingExerciseIds.delete(exerciseId);
    }
  }

  const notes: Record<number, string> = {};
  if (planExerciseIds.length > 0 && recentSessions && recentSessions.length > 0) {
    const sessionIds = recentSessions.map((s) => s.id);
    const sessionDateById = new Map(recentSessions.map((s) => [s.id, s.session_date]));
    const { data: noteRows, error: notesError } = await supabase
      .from('workout_session_exercise_notes')
      .select('session_id, plan_exercise_id, note')
      .in('session_id', sessionIds)
      .in('plan_exercise_id', planExerciseIds)
      .returns<{ session_id: number; plan_exercise_id: number; note: string | null }[]>();
    if (notesError) throw notesError;

    const sorted = (noteRows ?? [])
      .filter((row) => row.note)
      .sort((a, b) => (sessionDateById.get(b.session_id) ?? '').localeCompare(sessionDateById.get(a.session_id) ?? ''));
    for (const row of sorted) {
      if (!(row.plan_exercise_id in notes)) notes[row.plan_exercise_id] = row.note!;
    }
  }

  return { setValues, notes };
}

export interface ExerciseSetup {
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  increase_weight_next: boolean;
}

interface PreviousSetupRow {
  exercise_id: number;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  increase_weight_next: boolean;
}

interface PreviousSetupSessionRow {
  session_date: string;
  workout_session_sets: PreviousSetupRow[];
}

// "Setup atual" de um exercício = reps/peso/tempo da última série (maior
// set_number) da sessão mais recente, antes de hoje, em que ele foi feito
// — comparado contra a última série de hoje pra detectar recorde (ver
// isBetterSetup em DailyWorkoutPage). Mesma janela de sessões recentes de
// fetchLastUsedValues, mesmo princípio: olha as últimas N sessões e pega
// a primeira ocorrência de cada exercício (a mais recente).
export async function fetchPreviousExerciseSetups(
  exerciseIds: number[],
  todayStr: string
): Promise<Map<number, ExerciseSetup>> {
  const setups = new Map<number, ExerciseSetup>();
  if (exerciseIds.length === 0) return setups;

  const { data: recentSessions, error } = await supabase
    .from('workout_sessions')
    .select(
      'session_date, workout_session_sets (exercise_id, set_number, reps, weight_kg, duration_seconds, increase_weight_next)'
    )
    .lt('session_date', todayStr)
    .order('session_date', { ascending: false })
    .limit(RECENT_SESSIONS_LOOKBACK)
    .returns<PreviousSetupSessionRow[]>();
  if (error) throw error;

  const remaining = new Set(exerciseIds);
  for (const session of recentSessions ?? []) {
    if (remaining.size === 0) break;
    const lastSetByExercise = new Map<number, PreviousSetupRow>();
    for (const row of session.workout_session_sets ?? []) {
      if (!remaining.has(row.exercise_id)) continue;
      const current = lastSetByExercise.get(row.exercise_id);
      if (!current || row.set_number > current.set_number) lastSetByExercise.set(row.exercise_id, row);
    }
    for (const [exerciseId, row] of lastSetByExercise) {
      setups.set(exerciseId, {
        reps: row.reps,
        weight_kg: row.weight_kg,
        duration_seconds: row.duration_seconds,
        increase_weight_next: row.increase_weight_next,
      });
      remaining.delete(exerciseId);
    }
  }
  return setups;
}

interface BestSetRow {
  exercise_id: number;
  reps: number;
  weight_kg: number;
}

// Maior 1RM estimado (Epley) já registrado por exercício, em qualquer
// sessão/data — base pra detecção de PR e pra calculadora de 1RM. Só
// olha séries de força (reps + peso preenchidos); cardio não entra.
export async function fetchBestEstimated1RM(exerciseIds: number[]): Promise<Map<number, number>> {
  const best = new Map<number, number>();
  if (exerciseIds.length === 0) return best;

  const { data, error } = await supabase
    .from('workout_session_sets')
    .select('exercise_id, reps, weight_kg')
    .in('exercise_id', exerciseIds)
    .eq('completed', true)
    .not('reps', 'is', null)
    .not('weight_kg', 'is', null)
    .returns<BestSetRow[]>();
  if (error) throw error;

  for (const row of data ?? []) {
    const estimate = estimateOneRepMax(row.weight_kg, row.reps);
    if (estimate > (best.get(row.exercise_id) ?? 0)) best.set(row.exercise_id, estimate);
  }
  return best;
}

export async function updateSessionSet(id: number, patch: SessionSetPatch): Promise<void> {
  const { error } = await supabase.from('workout_session_sets').update(patch).eq('id', id);
  if (error) throw error;
}

export async function updateExerciseNote(sessionId: number, planExerciseId: number, note: string): Promise<void> {
  const { error } = await supabase
    .from('workout_session_exercise_notes')
    .upsert(
      { session_id: sessionId, plan_exercise_id: planExerciseId, note: note.trim() || null, updated_at: new Date().toISOString() },
      { onConflict: 'session_id,plan_exercise_id' }
    );
  if (error) throw error;
}

export async function completeSession(sessionId: number, summary?: WorkoutSummaryInput): Promise<string> {
  const completedAt = new Date().toISOString();

  // Concluir trava a lista de exercícios do plano no estado de agora, se
  // ainda não estava travada — reabrir o treino depois não desfaz isso
  // (o campo só é setado aqui e em resolveSession, nunca limpo).
  const { data: session, error: sessionError } = await supabase
    .from('workout_sessions')
    .select('plan_id, locked_plan_exercises')
    .eq('id', sessionId)
    .single<{ plan_id: number | null; locked_plan_exercises: PlanExercise[] | null }>();
  if (sessionError) throw sessionError;

  const patch: { completed_at: string; locked_plan_exercises?: PlanExercise[] } & Partial<WorkoutSummaryInput> = {
    completed_at: completedAt,
    ...summary,
  };
  if (session.locked_plan_exercises == null && session.plan_id != null) {
    patch.locked_plan_exercises = await fetchLivePlanExercises(session.plan_id);
  }

  const { error } = await supabase.from('workout_sessions').update(patch).eq('id', sessionId);
  if (error) throw error;
  return completedAt;
}

export async function reopenSession(sessionId: number): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .update({ completed_at: null })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function deleteSession(sessionId: number): Promise<void> {
  const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

interface TodaySessionRow {
  completed_at: string | null;
  canceled_at: string | null;
  duration_minutes: number | null;
  calories: number | null;
  heart_rate_avg: number | null;
  heart_rate_max: number | null;
  mood: WorkoutSummaryInput['mood'];
  workout_session_sets: { completed: boolean }[];
}

export interface TodaySessionStatus {
  completedAt: string | null;
  percent: number;
  summary: WorkoutSummaryInput;
}

// Versão somente-leitura de resolveSession — usada pelo card da Home só
// pra checar o status do dia, sem criar uma sessão (e suas séries) à toa
// toda vez que a Home é aberta. Busca por data (não por plan_id) pelo
// mesmo motivo de resolveSession: a sessão já existente manda, não a
// agenda ao vivo. Um dia cancelado conta como se não tivesse sessão.
export async function fetchTodaySessionStatus(dateStr: string): Promise<TodaySessionStatus | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(
      'completed_at, canceled_at, duration_minutes, calories, heart_rate_avg, heart_rate_max, mood, workout_session_sets (completed)'
    )
    .eq('session_date', dateStr)
    .order('id', { ascending: true })
    .limit(1)
    .returns<TodaySessionRow[]>();
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const row = data[0];
  if (row.canceled_at != null) return null;

  const sets = row.workout_session_sets ?? [];
  const percent = sets.length === 0 ? 0 : Math.round((sets.filter((s) => s.completed).length / sets.length) * 100);
  return {
    completedAt: row.completed_at,
    percent,
    summary: {
      duration_minutes: row.duration_minutes,
      calories: row.calories,
      heart_rate_avg: row.heart_rate_avg,
      heart_rate_max: row.heart_rate_max,
      mood: row.mood,
    },
  };
}

export interface MonthSessionInfo {
  percent: number;
  canceled: boolean;
  hasRecord: boolean;
}

interface MonthSessionRow {
  session_date: string;
  canceled_at: string | null;
  workout_session_sets: { completed: boolean; is_record: boolean }[];
}

// Info por dia pra quem já tem sessão registrada (avulsa ou da agenda,
// mesmo sem nenhuma série ainda — a sessão é criada sob demanda ao abrir
// Treino do dia, ou na hora ao escolher um treino avulso) — usado pelo
// calendário da Home. Dias cancelados entram marcados como tal, pra quem
// consumir saber que não é mais um dia de treino (mesmo que a agenda
// semanal diga o contrário). hasRecord reflete is_record já persistido
// nas séries, sem precisar recalcular nada pra exibir o troféu do mês.
export async function fetchMonthSessionProgress(from: Date, to: Date): Promise<Record<string, MonthSessionInfo>> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('session_date, canceled_at, workout_session_sets (completed, is_record)')
    .gte('session_date', format(from, 'yyyy-MM-dd'))
    .lte('session_date', format(to, 'yyyy-MM-dd'))
    .returns<MonthSessionRow[]>();
  if (error) throw error;

  const result: Record<string, MonthSessionInfo> = {};
  for (const row of data ?? []) {
    const sets = row.workout_session_sets ?? [];
    const percent = sets.length === 0 ? 0 : Math.round((sets.filter((s) => s.completed).length / sets.length) * 100);
    result[row.session_date] = {
      percent,
      canceled: row.canceled_at != null,
      hasRecord: sets.some((s) => s.is_record),
    };
  }
  return result;
}

interface EffectivePlanRow {
  plan_id: number | null;
  canceled_at: string | null;
  workout_plans: { name: string } | null;
}

// Plano "de fato" de uma data pra exibição (ex.: card da Home) — mesma
// precedência de resolveSession: sessão já existente manda (avulsa ou
// cancelada), só cai pra agenda semanal se a data ainda não tem sessão.
export async function fetchEffectivePlanForDate(date: Date): Promise<{ plan_id: number; plan_name: string } | null> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('plan_id, canceled_at, workout_plans (name)')
    .eq('session_date', dateStr)
    .order('id', { ascending: true })
    .limit(1)
    .returns<EffectivePlanRow[]>();
  if (error) throw error;

  const session = data && data.length > 0 ? data[0] : null;
  if (session) {
    if (session.canceled_at != null) return null;
    if (session.plan_id != null) {
      return { plan_id: session.plan_id, plan_name: session.workout_plans?.name ?? 'Plano' };
    }
  }
  return fetchScheduledPlanForDate(date);
}
