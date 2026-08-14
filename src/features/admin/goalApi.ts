import { supabase } from '../../lib/supabaseClient';

export interface UserGoal {
  birth_date: string | null;
  desired_weight_kg: number | null;
}

export async function fetchGoal(): Promise<UserGoal | null> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('birth_date, desired_weight_kg')
    .maybeSingle<UserGoal>();
  if (error) throw error;
  return data;
}

export async function upsertGoal(input: UserGoal): Promise<void> {
  const { error } = await supabase.from('user_goals').upsert(input, { onConflict: 'owner_id' });
  if (error) throw error;
}
