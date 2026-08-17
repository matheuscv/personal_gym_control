import { supabase } from '../../lib/supabaseClient';

export type ProgressMetric = 'weight' | 'duration';

export interface ExerciseProgressPoint {
  date: string;
  value: number;
}

export interface ExerciseProgress {
  exerciseId: number;
  exerciseName: string;
  metric: ProgressMetric;
  points: ExerciseProgressPoint[];
}

interface SetRow {
  weight_kg: number | null;
  duration_seconds: number | null;
  exercise_id: number;
  exercises: { name: string } | null;
  workout_sessions: { session_date: string } | null;
}

interface ExerciseAccum {
  name: string;
  hasWeight: boolean;
  hasDuration: boolean;
  maxWeightByDate: Map<string, number>;
  maxDurationByDate: Map<string, number>;
}

export async function fetchExerciseProgress(): Promise<ExerciseProgress[]> {
  const { data, error } = await supabase
    .from('workout_session_sets')
    .select('weight_kg, duration_seconds, exercise_id, exercises (name), workout_sessions (session_date)')
    .eq('completed', true)
    .returns<SetRow[]>();
  if (error) throw error;

  const byExercise = new Map<number, ExerciseAccum>();

  for (const row of data ?? []) {
    const date = row.workout_sessions?.session_date;
    if (!date) continue;

    const entry = byExercise.get(row.exercise_id) ?? {
      name: row.exercises?.name ?? '(exercício removido)',
      hasWeight: false,
      hasDuration: false,
      maxWeightByDate: new Map<string, number>(),
      maxDurationByDate: new Map<string, number>(),
    };

    if (row.weight_kg != null && row.weight_kg > 0) {
      entry.hasWeight = true;
      const currentMax = entry.maxWeightByDate.get(date) ?? 0;
      if (row.weight_kg > currentMax) entry.maxWeightByDate.set(date, row.weight_kg);
    }
    if (row.duration_seconds != null && row.duration_seconds > 0) {
      entry.hasDuration = true;
      const currentMax = entry.maxDurationByDate.get(date) ?? 0;
      if (row.duration_seconds > currentMax) entry.maxDurationByDate.set(date, row.duration_seconds);
    }

    byExercise.set(row.exercise_id, entry);
  }

  return Array.from(byExercise.entries())
    .map(([exerciseId, entry]) => {
      // Exercício sem carga registrada (isométrico/por tempo, ex.:
      // prancha) mas com tempo preenchido passa a acompanhar segundos em
      // vez de kg no gráfico.
      const metric: ProgressMetric = !entry.hasWeight && entry.hasDuration ? 'duration' : 'weight';
      const maxByDate = metric === 'duration' ? entry.maxDurationByDate : entry.maxWeightByDate;
      return {
        exerciseId,
        exerciseName: entry.name,
        metric,
        points: Array.from(maxByDate.entries())
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    })
    .filter((exercise) => exercise.points.length > 0)
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}
