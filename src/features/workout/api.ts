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
  completed_at: string | null;
}

async function resolveSession(planId: number, today: string): Promise<SessionRow> {
  const { data: existingSession, error: sessionLookupError } = await supabase
    .from('workout_sessions')
    .select('id, completed_at')
    .eq('plan_id', planId)
    .eq('session_date', today)
    .maybeSingle<SessionRow>();
  if (sessionLookupError) throw sessionLookupError;
  if (existingSession) return existingSession;

  const { data: newSession, error: sessionInsertError } = await supabase
    .from('workout_sessions')
    .insert({ plan_id: planId, session_date: today })
    .select('id, completed_at')
    .single<SessionRow>();
  if (sessionInsertError) throw sessionInsertError;
  return newSession;
}

export async function loadDailyWorkout(planId: number, date: Date): Promise<DailyWorkout> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const session = await resolveSession(planId, dateStr);
  const sessionId = session.id;

  const { data: planExerciseRows, error: planExercisesError } = await supabase
    .from('workout_plan_exercises')
    .select('id, order_index, target_sets, target_reps, exercise_id, exercises (name, muscle_group)')
    .eq('plan_id', planId)
    .order('order_index')
    .returns<PlanExerciseRow[]>();
  if (planExercisesError) throw planExercisesError;

  const planExercises: PlanExercise[] = (planExerciseRows ?? []).map((row) => ({
    id: row.id,
    order_index: row.order_index,
    target_sets: row.target_sets,
    target_reps: row.target_reps,
    exercise_id: row.exercise_id,
    exercise_name: row.exercises?.name ?? '(exercício removido)',
    muscle_group: row.exercises?.muscle_group ?? null,
  }));

  const { data: existingSets, error: setsError } = await supabase
    .from('workout_session_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('set_number')
    .returns<SessionSet[]>();
  if (setsError) throw setsError;

  const setsByPlanExercise = new Map<number, number>();
  for (const set of existingSets ?? []) {
    if (set.plan_exercise_id == null) continue;
    setsByPlanExercise.set(set.plan_exercise_id, (setsByPlanExercise.get(set.plan_exercise_id) ?? 0) + 1);
  }

  const missingSets = planExercises.flatMap((pe) => {
    const targetSets = pe.target_sets ?? 1;
    const existingCount = setsByPlanExercise.get(pe.id) ?? 0;
    return Array.from({ length: Math.max(0, targetSets - existingCount) }, (_, i) => ({
      session_id: sessionId,
      exercise_id: pe.exercise_id,
      plan_exercise_id: pe.id,
      set_number: existingCount + i + 1,
    }));
  });

  let sets = existingSets ?? [];
  if (missingSets.length > 0) {
    const { data: insertedSets, error: insertSetsError } = await supabase
      .from('workout_session_sets')
      .insert(missingSets)
      .select('*')
      .returns<SessionSet[]>();
    if (insertSetsError) throw insertSetsError;
    sets = [...sets, ...(insertedSets ?? [])];
  }

  return { sessionId, completedAt: session.completed_at, planExercises, sets };
}

export async function updateSessionSet(id: number, patch: SessionSetPatch): Promise<void> {
  const { error } = await supabase.from('workout_session_sets').update(patch).eq('id', id);
  if (error) throw error;
}

export async function completeSession(sessionId: number): Promise<string> {
  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from('workout_sessions')
    .update({ completed_at: completedAt })
    .eq('id', sessionId);
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
