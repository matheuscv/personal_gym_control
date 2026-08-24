import { z } from 'zod';

export const importPlanExerciseSchema = z.object({
  name: z.string().trim().min(1, 'Nome do exercício é obrigatório'),
  muscle_group: z.string().trim().min(1).nullish(),
  target_sets: z.number().int().positive().nullish(),
  target_reps: z.string().trim().min(1).nullish(),
  metric_type: z.enum(['strength', 'cardio']).nullish(),
});

export const importPlanSchema = z.object({
  name: z.string().trim().min(1, 'Nome do plano é obrigatório'),
  exercises: z.array(importPlanExerciseSchema).min(1, 'Informe ao menos um exercício'),
});

export type ImportPlanExerciseInput = z.infer<typeof importPlanExerciseSchema>;
export type ImportPlanInput = z.infer<typeof importPlanSchema>;
