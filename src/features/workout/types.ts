export interface WorkoutPlan {
  id: number;
  name: string;
  is_active: boolean;
}

export type MetricType = 'strength' | 'cardio';

export interface PlanExercise {
  id: number;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  rest_seconds: number;
  exercise_id: number;
  exercise_name: string;
  muscle_group: string | null;
  metric_type: MetricType;
}

export interface SessionSet {
  id: number;
  plan_exercise_id: number | null;
  exercise_id: number;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_km: number | null;
  incline_degree: number | null;
  calories: number | null;
  completed: boolean;
  // Marca se, ao concluir a última série do exercício, reps/peso/tempo
  // bateram o "setup" da última vez que o exercício foi feito.
  is_record: boolean;
  // "Aumentar peso no próximo treino" — só existe na última série do
  // exercício; carregado pra próxima execução como parte do setup (ver
  // loadDailyWorkout/fetchPreviousExerciseSetups), não reseta sozinho.
  increase_weight_next: boolean;
}

export type WorkoutMood = 'exhausted' | 'tired' | 'good' | 'excellent';

export interface WorkoutSummaryInput {
  duration_minutes: number | null;
  calories: number | null;
  heart_rate_avg: number | null;
  heart_rate_max: number | null;
  mood: WorkoutMood | null;
}

export interface DailyWorkout {
  sessionId: number;
  completedAt: string | null;
  // Resumo opcional capturado ao concluir o dia (ver WorkoutSummaryModal)
  // — todos os campos nulos enquanto o dia não foi concluído ou o usuário
  // marcou "Não informar".
  summary: WorkoutSummaryInput;
  // Plano de fato usado nesse dia — vem da sessão já existente quando
  // houver uma (pode divergir do que está agendado hoje na semana, se a
  // agenda mudou depois), não da agenda ao vivo.
  planId: number | null;
  planName: string;
  planExercises: PlanExercise[];
  sets: SessionSet[];
  // Comentário livre por exercício do plano, indexado por plan_exercise_id.
  exerciseNotes: Record<number, string>;
}

export type SessionSetPatch = Partial<
  Pick<
    SessionSet,
    | 'reps'
    | 'weight_kg'
    | 'duration_seconds'
    | 'distance_km'
    | 'incline_degree'
    | 'calories'
    | 'completed'
    | 'is_record'
    | 'increase_weight_next'
  >
>;
