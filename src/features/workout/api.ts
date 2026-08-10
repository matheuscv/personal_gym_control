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

interface PlanExerciseRow {
  id: number;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  exercise_id: number;
  exercises: { name: string; muscle_group: string | null } | null;
}

async function resolveSessionId(planId: number, today: string): Promise<number> {
  const { data: existingSession, error: sessionLookupError } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('plan_id', planId)
    .eq('session_date', today)
    .maybeSingle<{ id: number }>();
  if (sessionLookupError) throw sessionLookupError;
  if (existingSession) return existingSession.id;

  const { data: newSession, error: sessionInsertError } = await supabase
    .from('workout_sessions')
    .insert({ plan_id: planId, session_date: today })
    .select('id')
    .single<{ id: number }>();
  if (sessionInsertError) throw sessionInsertError;
  return newSession.id;
}

export async function loadDailyWorkout(planId: number): Promise<DailyWorkout> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const sessionId = await resolveSessionId(planId, today);

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

  return { sessionId, planExercises, sets };
}

export async function updateSessionSet(id: number, patch: SessionSetPatch): Promise<void> {
  const { error } = await supabase.from('workout_session_sets').update(patch).eq('id', id);
  if (error) throw error;
}
