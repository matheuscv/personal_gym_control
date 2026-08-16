import { z } from 'zod';

const compositionRowSchema = z.object({
  min: z.number(),
  max: z.number(),
  avaliacao: z.string().trim().min(1),
});

// Faixa de referência + avaliação da tabela "Análise da composição
// corporal" do relatório — só vem de importação (extraída da foto/PDF
// original), nunca do formulário manual.
const compositionAnalysisSchema = z
  .object({
    peso: compositionRowSchema.nullish(),
    massa_gorda: compositionRowSchema.nullish(),
    massa_ossea: compositionRowSchema.nullish(),
    massa_proteica: compositionRowSchema.nullish(),
    agua_corporal: compositionRowSchema.nullish(),
    massa_muscular: compositionRowSchema.nullish(),
  })
  .nullish();

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
  composition_analysis: compositionAnalysisSchema,
});

export type BodyReportInput = z.infer<typeof bodyReportSchema>;
export type CompositionAnalysis = z.infer<typeof compositionAnalysisSchema>;
