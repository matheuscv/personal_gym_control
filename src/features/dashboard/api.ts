import { supabase } from '../../lib/supabaseClient';

export interface ExerciseProgressPoint {
  date: string;
  maxWeight: number;
}

export interface ExerciseProgress {
  exerciseId: number;
  exerciseName: string;
  points: ExerciseProgressPoint[];
}

interface SetRow {
  weight_kg: number;
  exercise_id: number;
  exercises: { name: string } | null;
  workout_sessions: { session_date: string } | null;
}

export async function fetchExerciseProgress(): Promise<ExerciseProgress[]> {
  const { data, error } = await supabase
    .from('workout_session_sets')
    .select('weight_kg, exercise_id, exercises (name), workout_sessions (session_date)')
    .eq('completed', true)
    .not('weight_kg', 'is', null)
    .returns<SetRow[]>();
  if (error) throw error;

  const byExercise = new Map<number, { name: string; maxByDate: Map<string, number> }>();

  for (const row of data ?? []) {
    const date = row.workout_sessions?.session_date;
    if (!date) continue;

    const entry = byExercise.get(row.exercise_id) ?? {
      name: row.exercises?.name ?? '(exercício removido)',
      maxByDate: new Map<string, number>(),
    };
    const currentMax = entry.maxByDate.get(date) ?? 0;
    if (row.weight_kg > currentMax) {
      entry.maxByDate.set(date, row.weight_kg);
    }
    byExercise.set(row.exercise_id, entry);
  }

  return Array.from(byExercise.entries())
    .map(([exerciseId, { name, maxByDate }]) => ({
      exerciseId,
      exerciseName: name,
      points: Array.from(maxByDate.entries())
        .map(([date, maxWeight]) => ({ date, maxWeight }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}
