import { z } from 'zod';

export const bodyReportSchema = z.object({
  measured_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)'),
  notes: z.string().trim().min(1).nullish(),
  peso_kg: z.number().positive().nullish(),
  imc: z.number().positive().nullish(),
  gordura_corporal_pct: z.number().min(0).max(100).nullish(),
  massa_muscular_kg: z.number().positive().nullish(),
  massa_ossea_kg: z.number().positive().nullish(),
  agua_corporal_pct: z.number().min(0).max(100).nullish(),
  proteina_pct: z.number().min(0).max(100).nullish(),
  gordura_visceral: z.number().min(0).nullish(),
  tmb_kcal: z.number().positive().nullish(),
  peso_livre_gordura_kg: z.number().positive().nullish(),
  gordura_subcutanea_pct: z.number().min(0).max(100).nullish(),
  smi_kg_m2: z.number().positive().nullish(),
  idade_corporal: z.number().int().positive().nullish(),
  whr: z.number().positive().nullish(),
  peso_alvo_kg: z.number().positive().nullish(),
  controle_peso_kg: z.number().nullish(),
  grau_obesidade_pct: z.number().nullish(),
});

export type BodyReportInput = z.infer<typeof bodyReportSchema>;
