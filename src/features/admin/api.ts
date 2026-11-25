import { supabase } from '../../lib/supabaseClient';
import type { ImportPlanInput } from '../../../api/_lib/importSchema';
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
  const { data, error } = await supabase
    .from('workout_plans')
    .select('id, name, is_active')
    .is('deleted_at', null)
    .order('name');
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

// Move pra lixeira em vez de apagar de vez (ver TrashPage/trashApi) — além
// de marcar deleted_at, limpa qualquer dia da agenda semanal que ainda
// apontava pra esse plano (isso não é "lixeira", é só um ponteiro órfão,
// removido de verdade mesmo).
export async function deletePlan(id: number): Promise<void> {
  const { error } = await supabase
    .from('workout_plans')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;

  const { error: scheduleError } = await supabase.from('workout_weekly_schedule').delete().eq('plan_id', id);
  if (scheduleError) throw scheduleError;
}

interface PlanExerciseRow {
  id: number;
  plan_id: number;
  exercise_id: number;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  rest_seconds: number;
  exercises: { name: string } | null;
}

export async function fetchPlanExercises(planId: number): Promise<PlanExerciseAdmin[]> {
  const { data, error } = await supabase
    .from('workout_plan_exercises')
    .select('id, plan_id, exercise_id, order_index, target_sets, target_reps, rest_seconds, exercises (name)')
    .eq('plan_id', planId)
    .is('deleted_at', null)
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
    rest_seconds: row.rest_seconds,
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

// Move pra lixeira em vez de apagar de vez — ver TrashPage/trashApi.
export async function removePlanExercise(id: number): Promise<void> {
  const { error } = await supabase
    .from('workout_plan_exercises')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updatePlanExercise(
  id: number,
  patch: Partial<Pick<PlanExerciseAdmin, 'target_sets' | 'target_reps' | 'rest_seconds'>>
): Promise<void> {
  const { error } = await supabase.from('workout_plan_exercises').update(patch).eq('id', id);
  if (error) throw error;
}

// --- Lixeira: planos e exercícios de plano apagados, ver TrashPage/trashApi ---

export interface TrashedPlan {
  id: number;
  name: string;
  deleted_at: string;
}

export async function fetchTrashedPlans(): Promise<TrashedPlan[]> {
  const { data, error } = await supabase
    .from('workout_plans')
    .select('id, name, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .returns<TrashedPlan[]>();
  if (error) throw error;
  return data ?? [];
}

export async function restorePlan(id: number): Promise<void> {
  const { error } = await supabase.from('workout_plans').update({ deleted_at: null }).eq('id', id);
  if (error) throw error;
}

export async function hardDeletePlan(id: number): Promise<void> {
  const { error } = await supabase.from('workout_plans').delete().eq('id', id);
  if (error) throw error;
}

interface TrashedPlanExerciseRow {
  id: number;
  deleted_at: string;
  exercises: { name: string } | null;
  workout_plans: { name: string } | null;
}

export interface TrashedPlanExercise {
  id: number;
  exercise_name: string;
  plan_name: string;
  deleted_at: string;
}

export async function fetchTrashedPlanExercises(): Promise<TrashedPlanExercise[]> {
  const { data, error } = await supabase
    .from('workout_plan_exercises')
    .select('id, deleted_at, exercises (name), workout_plans (name)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .returns<TrashedPlanExerciseRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    exercise_name: row.exercises?.name ?? '(exercício removido)',
    plan_name: row.workout_plans?.name ?? '(plano removido)',
    deleted_at: row.deleted_at,
  }));
}

export async function restorePlanExercise(id: number): Promise<void> {
  const { error } = await supabase.from('workout_plan_exercises').update({ deleted_at: null }).eq('id', id);
  if (error) throw error;
}

export async function hardDeletePlanExercise(id: number): Promise<void> {
  const { error } = await supabase.from('workout_plan_exercises').delete().eq('id', id);
  if (error) throw error;
}

export async function swapPlanExerciseOrder(
  a: { id: number; order_index: number },
  b: { id: number; order_index: number }
): Promise<void> {
  const { error } = await supabase.rpc('swap_plan_exercise_order', { id_a: a.id, id_b: b.id });
  if (error) throw error;
}

interface ExportPlanExerciseRow {
  plan_id: number;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  exercises: { name: string; muscle_group: string | null; metric_type: 'strength' | 'cardio' } | null;
}

// Export de segurança — mesma forma aceita pelo importador (ImportPlanInput),
// então o arquivo baixado já é diretamente reimportável se precisar.
export async function exportAllPlans(): Promise<ImportPlanInput[]> {
  const { data: plans, error: plansError } = await supabase
    .from('workout_plans')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')
    .returns<{ id: number; name: string }[]>();
  if (plansError) throw plansError;
  if (!plans || plans.length === 0) return [];

  const { data: planExerciseRows, error: exercisesError } = await supabase
    .from('workout_plan_exercises')
    .select('plan_id, order_index, target_sets, target_reps, exercises (name, muscle_group, metric_type)')
    .in('plan_id', plans.map((p) => p.id))
    .is('deleted_at', null)
    .order('order_index')
    .returns<ExportPlanExerciseRow[]>();
  if (exercisesError) throw exercisesError;

  const exercisesByPlanId = new Map<number, ImportPlanInput['exercises']>();
  for (const row of planExerciseRows ?? []) {
    if (!row.exercises) continue;
    const list = exercisesByPlanId.get(row.plan_id) ?? [];
    list.push({
      name: row.exercises.name,
      muscle_group: row.exercises.muscle_group,
      target_sets: row.target_sets,
      target_reps: row.target_reps,
      metric_type: row.exercises.metric_type,
    });
    exercisesByPlanId.set(row.plan_id, list);
  }

  return plans
    .map((plan) => ({ name: plan.name, exercises: exercisesByPlanId.get(plan.id) ?? [] }))
    .filter((plan) => plan.exercises.length > 0);
}
