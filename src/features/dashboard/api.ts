import { supabase } from '../../lib/supabaseClient';

export type MetricKey = 'weight' | 'duration' | 'distance' | 'incline' | 'calories';

export interface ExerciseProgressPoint {
  date: string;
  values: Partial<Record<MetricKey, number>>;
}

export interface ExerciseProgress {
  exerciseId: number;
  exerciseName: string;
  metricKeys: MetricKey[];
  points: ExerciseProgressPoint[];
  planName: string | null;
}

interface SetRow {
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_km: number | null;
  incline_degree: number | null;
  calories: number | null;
  exercise_id: number;
  exercises: { name: string; metric_type: 'strength' | 'cardio' } | null;
  workout_sessions: { session_date: string } | null;
}

interface ExerciseAccum {
  name: string;
  metricType: 'strength' | 'cardio';
  hasWeight: boolean;
  hasDuration: boolean;
  maxByDate: Record<MetricKey, Map<string, number>>;
}

function emptyMaxByDate(): Record<MetricKey, Map<string, number>> {
  return {
    weight: new Map(),
    duration: new Map(),
    distance: new Map(),
    incline: new Map(),
    calories: new Map(),
  };
}

function trackMax(maxByDate: Map<string, number>, date: string, value: number | null): void {
  if (value == null) return;
  const current = maxByDate.get(date) ?? -Infinity;
  if (value > current) maxByDate.set(date, value);
}

export async function fetchExerciseProgress(): Promise<ExerciseProgress[]> {
  const { data, error } = await supabase
    .from('workout_session_sets')
    .select(
      'weight_kg, duration_seconds, distance_km, incline_degree, calories, exercise_id, exercises (name, metric_type), workout_sessions (session_date)'
    )
    .eq('completed', true)
    .returns<SetRow[]>();
  if (error) throw error;

  // Nome do treino (plano) de cada exercício, pra agrupar a Evolução
  // Treino — usa a associação atual (plano vivo), não a de quando a série
  // foi registrada. Exercício em mais de um plano fica com o primeiro
  // encontrado; fora de qualquer plano (removido depois) cai no grupo
  // "Sem plano".
  const { data: planExerciseRows, error: planError } = await supabase
    .from('workout_plan_exercises')
    .select('exercise_id, workout_plans (name)')
    .returns<{ exercise_id: number; workout_plans: { name: string } | null }[]>();
  if (planError) throw planError;

  const planNameByExercise = new Map<number, string>();
  for (const row of planExerciseRows ?? []) {
    if (!planNameByExercise.has(row.exercise_id) && row.workout_plans?.name) {
      planNameByExercise.set(row.exercise_id, row.workout_plans.name);
    }
  }

  const byExercise = new Map<number, ExerciseAccum>();

  for (const row of data ?? []) {
    const date = row.workout_sessions?.session_date;
    if (!date) continue;

    const entry = byExercise.get(row.exercise_id) ?? {
      name: row.exercises?.name ?? '(exercício removido)',
      metricType: row.exercises?.metric_type ?? 'strength',
      hasWeight: false,
      hasDuration: false,
      maxByDate: emptyMaxByDate(),
    };

    if (entry.metricType === 'cardio') {
      trackMax(entry.maxByDate.duration, date, row.duration_seconds != null ? row.duration_seconds / 60 : null);
      trackMax(entry.maxByDate.distance, date, row.distance_km);
      trackMax(entry.maxByDate.incline, date, row.incline_degree);
      trackMax(entry.maxByDate.calories, date, row.calories);
    } else {
      if (row.weight_kg != null && row.weight_kg > 0) {
        entry.hasWeight = true;
        trackMax(entry.maxByDate.weight, date, row.weight_kg);
      }
      if (row.duration_seconds != null && row.duration_seconds > 0) {
        entry.hasDuration = true;
        trackMax(entry.maxByDate.duration, date, row.duration_seconds);
      }
    }

    byExercise.set(row.exercise_id, entry);
  }

  return Array.from(byExercise.entries())
    .map(([exerciseId, entry]) => {
      let metricKeys: MetricKey[];
      if (entry.metricType === 'cardio') {
        metricKeys = ['duration', 'distance', 'incline', 'calories'];
      } else {
        // Exercício sem carga registrada (isométrico/por tempo, ex.:
        // prancha) mas com tempo preenchido passa a acompanhar segundos em
        // vez de kg no gráfico.
        metricKeys = [!entry.hasWeight && entry.hasDuration ? 'duration' : 'weight'];
      }

      const dates = new Set<string>();
      for (const key of metricKeys) {
        for (const date of entry.maxByDate[key].keys()) dates.add(date);
      }

      const points = Array.from(dates)
        .sort()
        .map((date) => ({
          date,
          values: Object.fromEntries(
            metricKeys
              .map((key) => [key, entry.maxByDate[key].get(date)] as const)
              .filter(([, value]) => value != null)
          ) as Partial<Record<MetricKey, number>>,
        }));

      return {
        exerciseId,
        exerciseName: entry.name,
        metricKeys,
        points,
        planName: planNameByExercise.get(exerciseId) ?? null,
      };
    })
    .filter((exercise) => exercise.points.length > 0)
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}
