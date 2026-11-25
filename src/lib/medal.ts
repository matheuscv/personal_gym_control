export type MedalTier = 'gold' | 'silver' | 'bronze';

// Efeito motivacional no calendário e no detalhe do Treino do dia — só pra
// dias já com percentual real (passado/hoje), nunca pra dias futuros.
export function medalTierForPercent(percent: number): MedalTier | null {
  if (percent >= 100) return 'gold';
  if (percent >= 90) return 'silver';
  if (percent >= 80) return 'bronze';
  return null;
}
