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
