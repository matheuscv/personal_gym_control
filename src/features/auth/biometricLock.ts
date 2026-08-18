const KEY = 'pgc:biometric-lock-enabled';

// Preferência local ao aparelho (não faz parte do perfil do usuário) —
// controla se o app deve pedir digital ao abrir/retomar em primeiro
// plano, além da sessão do Supabase já persistida.
export function isBiometricLockEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setBiometricLockEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(KEY, '1');
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // localStorage indisponível (modo privado, cota excedida) — a
    // preferência não persiste, mas não quebra a UI.
  }
}
