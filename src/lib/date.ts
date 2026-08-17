import { format } from 'date-fns';

// Formato padrão de data exibida no app inteiro — sem ano, já que o uso é
// sempre acompanhar dados recentes/do ano corrente.
export function formatShortDate(dateStr: string): string {
  try {
    return format(new Date(`${dateStr}T00:00:00`), 'dd/MM');
  } catch {
    return dateStr;
  }
}
