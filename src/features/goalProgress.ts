export interface GoalProgress {
  initialWeight: number | null;
  currentWeight: number | null;
  desiredWeight: number | null;
  pendingKg: number | null;
  pendingPct: number | null;
}

/**
 * Mesma fórmula usada em Meu Objetivo e Evolução Corporal — peso inicial
 * (relatório mais antigo) é a base fixa de 100%, não o peso atual, senão a
 * referência ficaria se movendo a cada novo relatório cadastrado.
 */
export function computeGoalProgress(
  initialWeight: number | null,
  currentWeight: number | null,
  desiredWeight: number | null
): GoalProgress {
  const pendingKg = currentWeight != null && desiredWeight != null ? currentWeight - desiredWeight : null;
  const totalJourneyKg = initialWeight != null && desiredWeight != null ? initialWeight - desiredWeight : null;
  const pendingPct =
    pendingKg != null && totalJourneyKg ? (Math.abs(pendingKg) / Math.abs(totalJourneyKg)) * 100 : null;
  return { initialWeight, currentWeight, desiredWeight, pendingKg, pendingPct };
}
