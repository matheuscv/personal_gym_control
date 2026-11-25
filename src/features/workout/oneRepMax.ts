// Fórmula de Epley — estimativa padrão de 1RM a partir de peso x reps,
// usada tanto na detecção de PR quanto na calculadora de 1RM.
export function estimateOneRepMax(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

const SUGGESTED_PERCENTAGES = [100, 90, 80, 70, 60];

export function suggestedLoadsForOneRepMax(oneRepMaxKg: number): { percentage: number; weightKg: number }[] {
  return SUGGESTED_PERCENTAGES.map((percentage) => ({
    percentage,
    weightKg: Math.round(oneRepMaxKg * (percentage / 100) * 2) / 2, // arredonda pro 0,5kg mais próximo
  }));
}
