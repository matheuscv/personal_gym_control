export interface Exercise {
  id: number;
  name: string;
  muscle_group: string | null;
  notes: string | null;
  metric_type: 'strength' | 'cardio';
}

export interface Plan {
  id: number;
  name: string;
  is_active: boolean;
}

export interface PlanExerciseAdmin {
  id: number;
  plan_id: number;
  exercise_id: number;
  exercise_name: string;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
}
