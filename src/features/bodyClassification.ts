export type BodyLevel = 'Fino' | 'Padrão' | 'Alto' | 'Muito alto';

export function classifyImc(imc: number): BodyLevel {
  if (imc < 18.5) return 'Fino';
  if (imc < 25) return 'Padrão';
  if (imc < 30) return 'Alto';
  return 'Muito alto';
}

export function classifyBodyFatPct(pct: number): BodyLevel {
  if (pct < 10) return 'Fino';
  if (pct < 20) return 'Padrão';
  if (pct < 25) return 'Alto';
  return 'Muito alto';
}

export type MuscleLevel = 'Baixo' | 'Normal';

// Triagem de massa muscular baixa via SMI (kg/m²) — corte masculino (AWGS /
// bioimpedância). Sem dado de sexo armazenado no app hoje (coluna existe em
// profiles mas não é usada em tela nenhuma), fixo em masculino por ora.
const SMI_LOW_CUTOFF_MALE = 7.0;

export function classifySkeletalMuscleIndex(smiKgM2: number): MuscleLevel {
  return smiKgM2 < SMI_LOW_CUTOFF_MALE ? 'Baixo' : 'Normal';
}

export function muscleLevelClass(level: MuscleLevel): 'ok' | 'danger' {
  return level === 'Baixo' ? 'danger' : 'ok';
}

export function bodyLevelClass(level: BodyLevel): 'neutral' | 'ok' | 'accent' | 'danger' {
  switch (level) {
    case 'Fino':
      return 'neutral';
    case 'Padrão':
      return 'ok';
    case 'Alto':
      return 'accent';
    case 'Muito alto':
      return 'danger';
  }
}
