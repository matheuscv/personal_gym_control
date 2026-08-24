import { supabase } from '../../lib/supabaseClient';
import type { Exercise, Plan, PlanExerciseAdmin } from './types';

export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, notes, metric_type')
    .order('name');
  if (error) throw error;
  return data;
}

export async function upsertExerciseByName(input: {
  name: string;
  muscle_group: string | null;
  metric_type?: 'strength' | 'cardio';
}): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .upsert(input, { onConflict: 'owner_id,name' })
    .select('id, name, muscle_group, notes, metric_type')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from('workout_plans').select('id, name, is_active').order('name');
  if (error) throw error;
  return data;
}

export async function fetchPlan(id: number): Promise<Plan> {
  const { data, error } = await supabase
    .from('workout_plans')
    .select('id, name, is_active')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlan(id: number, patch: Partial<Pick<Plan, 'name' | 'is_active'>>): Promise<void> {
  const { error } = await supabase.from('workout_plans').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePlan(id: number): Promise<void> {
  const { error } = await supabase.from('workout_plans').delete().eq('id', id);
  if (error) throw error;
}

interface PlanExerciseRow {
  id: number;
  plan_id: number;
  exercise_id: number;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  exercises: { name: string } | null;
}

export async function fetchPlanExercises(planId: number): Promise<PlanExerciseAdmin[]> {
  const { data, error } = await supabase
    .from('workout_plan_exercises')
    .select('id, plan_id, exercise_id, order_index, target_sets, target_reps, exercises (name)')
    .eq('plan_id', planId)
    .order('order_index')
    .returns<PlanExerciseRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    plan_id: row.plan_id,
    exercise_id: row.exercise_id,
    exercise_name: row.exercises?.name ?? '(exercício removido)',
    order_index: row.order_index,
    target_sets: row.target_sets,
    target_reps: row.target_reps,
  }));
}

export async function addExerciseToPlan(input: {
  plan_id: number;
  exercise_id: number;
  target_sets: number | null;
  target_reps: string | null;
}): Promise<void> {
  const { data: maxRow } = await supabase
    .from('workout_plan_exercises')
    .select('order_index')
    .eq('plan_id', input.plan_id)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle<{ order_index: number }>();

  const nextOrderIndex = (maxRow?.order_index ?? 0) + 1;

  const { error } = await supabase.from('workout_plan_exercises').insert({
    plan_id: input.plan_id,
    exercise_id: input.exercise_id,
    target_sets: input.target_sets,
    target_reps: input.target_reps,
    order_index: nextOrderIndex,
  });
  if (error) throw error;
}

export async function removePlanExercise(id: number): Promise<void> {
  const { error } = await supabase.from('workout_plan_exercises').delete().eq('id', id);
  if (error) throw error;
}

export async function updatePlanExercise(
  id: number,
  patch: Partial<Pick<PlanExerciseAdmin, 'target_sets' | 'target_reps'>>
): Promise<void> {
  const { error } = await supabase.from('workout_plan_exercises').update(patch).eq('id', id);
  if (error) throw error;
}

export async function swapPlanExerciseOrder(
  a: { id: number; order_index: number },
  b: { id: number; order_index: number }
): Promise<void> {
  const { error } = await supabase.rpc('swap_plan_exercise_order', { id_a: a.id, id_b: b.id });
  if (error) throw error;
}
