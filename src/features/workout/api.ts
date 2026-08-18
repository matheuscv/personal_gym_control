import { format } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import type { DailyWorkout, PlanExercise, SessionSet, SessionSetPatch, WorkoutPlan } from './types';

export async function fetchActivePlans(): Promise<WorkoutPlan[]> {
  const { data, error } = await supabase
    .from('workout_plans')
    .select('id, name, is_active')
    .eq('is_active', true)
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
  exercise_id: number;
  exercises: { name: string; muscle_group: string | null } | null;
}

interface SessionRow {
  id: number;
  plan_id: number | null;
  completed_at: string | null;
  locked_plan_exercises: PlanExercise[] | null;
}

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
    .select('id, order_index, target_sets, target_reps, exercise_id, exercises (name, muscle_group)')
    .eq('plan_id', planId)
    .order('order_index')
    .returns<PlanExerciseRow[]>();
  if (error) throw error;

  return (planExerciseRows ?? []).map((row) => ({
    id: row.id,
    order_index: row.order_index,
    target_sets: row.target_sets,
    target_reps: row.target_reps,
    exercise_id: row.exercise_id,
    exercise_name: row.exercises?.name ?? '(exercício removido)',
    muscle_group: row.exercises?.muscle_group ?? null,
  }));
}

// Uma data tem no máximo uma sessão, independente de qual plano está
// agendado hoje pra esse dia da semana — buscar por plan_id+data faria
// uma troca na agenda "perder" a sessão antiga (e criar uma segunda pra
// mesma data). .limit(1) em vez de .maybeSingle() por segurança, caso
// ainda exista alguma duplicata de antes dessa correção.
async function resolveSession(scheduledPlanId: number, dateStr: string): Promise<SessionRow> {
  const { data: existingSessions, error: sessionLookupError } = await supabase
    .from('workout_sessions')
    .select('id, plan_id, completed_at, locked_plan_exercises')
    .eq('session_date', dateStr)
    .order('id', { ascending: true })
    .limit(1)
    .returns<SessionRow[]>();
  if (sessionLookupError) throw sessionLookupError;
  if (existingSessions && existingSessions.length > 0) return existingSessions[0];

  // Sessão criada pra uma data que já passou (ex.: primeira vez que se
  // visita um dia antigo) já nasce travada — editar o plano depois não
  // deve alterar a visão desse dia.
  const lockedPlanExercises = dateStr < todayStr() ? await fetchLivePlanExercises(scheduledPlanId) : null;

  const { data: newSession, error: sessionInsertError } = await supabase
    .from('workout_sessions')
    .insert({ plan_id: scheduledPlanId, session_date: dateStr, locked_plan_exercises: lockedPlanExercises })
    .select('id, plan_id, completed_at, locked_plan_exercises')
    .single<SessionRow>();
  if (sessionInsertError) throw sessionInsertError;
  return newSession;
}

// Só olha se já existe sessão pra data (sem criar) — usada pra descobrir
// o plano "de fato" daquele dia antes de decidir se precisa consultar a
// agenda ao vivo (que pode ter mudado desde então).
export async function fetchSessionForDate(
  dateStr: string
): Promise<{ planId: number | null; completedAt: string | null } | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('plan_id, completed_at')
    .eq('session_date', dateStr)
    .order('id', { ascending: true })
    .limit(1)
    .returns<{ plan_id: number | null; completed_at: string | null }[]>();
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return { planId: data[0].plan_id, completedAt: data[0].completed_at };
}

export async function loadDailyWorkout(scheduledPlanId: number, date: Date): Promise<DailyWorkout> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const session = await resolveSession(scheduledPlanId, dateStr);
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

  let planExercises: PlanExercise[];
  if (session.locked_plan_exercises) {
    planExercises = session.locked_plan_exercises;
  } else {
    planExercises = await fetchLivePlanExercises(effectivePlanId);
    if (isLocked) {
      // Devia estar travada mas ainda não tinha snapshot (dia já
      // passado, ou sessão concluída antes dessa trava existir) — trava
      // agora com o melhor snapshot disponível, pra parar de acompanhar
      // o plano vivo a partir daqui.
      await supabase.from('workout_sessions').update({ locked_plan_exercises: planExercises }).eq('id', sessionId);
    }
  }

  const planName = await fetchPlanName(effectivePlanId);

  const { data: existingSets, error: setsError } = await supabase
    .from('workout_session_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('set_number')
    .returns<SessionSet[]>();
  if (setsError) throw setsError;

  let liveSets = existingSets ?? [];

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

  const missingSets = isLocked
    ? []
    : planExercises.flatMap((pe) => {
        const targetSets = pe.target_sets ?? 1;
        const existingCount = setsByPlanExercise.get(pe.id) ?? 0;
        return Array.from({ length: Math.max(0, targetSets - existingCount) }, (_, i) => ({
          session_id: sessionId,
          exercise_id: pe.exercise_id,
          plan_exercise_id: pe.id,
          set_number: existingCount + i + 1,
        }));
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

  const { data: noteRows, error: notesError } = await supabase
    .from('workout_session_exercise_notes')
    .select('plan_exercise_id, note')
    .eq('session_id', sessionId)
    .returns<{ plan_exercise_id: number; note: string | null }[]>();
  if (notesError) throw notesError;

  const exerciseNotes: Record<number, string> = {};
  for (const row of noteRows ?? []) {
    if (row.note) exerciseNotes[row.plan_exercise_id] = row.note;
  }

  return {
    sessionId,
    completedAt: session.completed_at,
    planId: effectivePlanId,
    planName,
    planExercises,
    sets,
    exerciseNotes,
  };
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

export async function completeSession(sessionId: number): Promise<string> {
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

  const patch: { completed_at: string; locked_plan_exercises?: PlanExercise[] } = { completed_at: completedAt };
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
  workout_session_sets: { completed: boolean }[];
}

export interface TodaySessionStatus {
  completedAt: string | null;
  percent: number;
}

// Versão somente-leitura de resolveSession — usada pelo card da Home só
// pra checar o status do dia, sem criar uma sessão (e suas séries) à toa
// toda vez que a Home é aberta. Busca por data (não por plan_id) pelo
// mesmo motivo de resolveSession: a sessão já existente manda, não a
// agenda ao vivo.
export async function fetchTodaySessionStatus(dateStr: string): Promise<TodaySessionStatus | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('completed_at, workout_session_sets (completed)')
    .eq('session_date', dateStr)
    .order('id', { ascending: true })
    .limit(1)
    .returns<TodaySessionRow[]>();
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const row = data[0];

  const sets = row.workout_session_sets ?? [];
  const percent = sets.length === 0 ? 0 : Math.round((sets.filter((s) => s.completed).length / sets.length) * 100);
  return { completedAt: row.completed_at, percent };
}

interface MonthSessionRow {
  session_date: string;
  workout_session_sets: { completed: boolean }[];
}

// % de séries concluídas por dia, só pras datas que já têm sessão
// registrada (a sessão é criada sob demanda ao abrir Treino do dia) —
// usado pelo calendário da Home.
export async function fetchMonthSessionProgress(from: Date, to: Date): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('session_date, workout_session_sets (completed)')
    .gte('session_date', format(from, 'yyyy-MM-dd'))
    .lte('session_date', format(to, 'yyyy-MM-dd'))
    .returns<MonthSessionRow[]>();
  if (error) throw error;

  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    const sets = row.workout_session_sets ?? [];
    if (sets.length === 0) continue;
    const done = sets.filter((s) => s.completed).length;
    result[row.session_date] = Math.round((done / sets.length) * 100);
  }
  return result;
}
