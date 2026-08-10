export interface WorkoutPlan {
  id: number;
  name: string;
  is_active: boolean;
}

export interface PlanExercise {
  id: number;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  exercise_id: number;
  exercise_name: string;
  muscle_group: string | null;
}

export interface SessionSet {
  id: number;
  plan_exercise_id: number | null;
  exercise_id: number;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  completed: boolean;
}

export interface DailyWorkout {
  sessionId: number;
  planExercises: PlanExercise[];
  sets: SessionSet[];
}

export type SessionSetPatch = Partial<
  Pick<SessionSet, 'reps' | 'weight_kg' | 'duration_seconds' | 'completed'>
>;
