import { supabase } from '../../lib/supabaseClient';

export interface ScheduleDay {
  day_of_week: number;
  plan_id: number;
  plan_name: string;
}

interface ScheduleRow {
  day_of_week: number;
  plan_id: number;
  workout_plans: { name: string } | null;
}

export async function fetchWeeklySchedule(): Promise<ScheduleDay[]> {
  const { data, error } = await supabase
    .from('workout_weekly_schedule')
    .select('day_of_week, plan_id, workout_plans (name)')
    .returns<ScheduleRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    day_of_week: row.day_of_week,
    plan_id: row.plan_id,
    plan_name: row.workout_plans?.name ?? '(plano removido)',
  }));
}

export async function setScheduleDay(dayOfWeek: number, planId: number): Promise<void> {
  const { error } = await supabase
    .from('workout_weekly_schedule')
    .upsert({ day_of_week: dayOfWeek, plan_id: planId }, { onConflict: 'owner_id,day_of_week' });
  if (error) throw error;
}

export async function clearScheduleDay(dayOfWeek: number): Promise<void> {
  const { error } = await supabase.from('workout_weekly_schedule').delete().eq('day_of_week', dayOfWeek);
  if (error) throw error;
}
