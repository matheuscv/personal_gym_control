import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Fingerprint, LogOut } from 'lucide-react';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { useAuth } from './auth-context';
import { isBiometricLockEnabled } from './biometricLock';
import './BiometricLockGate.css';

// Só existe no bundle Android (ver ProtectedRoute) — a sessão do Supabase
// já fica persistida entre aberturas do app (localStorage), então isso
// não é "login" de fato: é uma trava local, por cima da sessão já válida,
// pra impedir que quem pegar o celular veja os dados sem autenticar de
// novo. addResumeListener reaplica a trava toda vez que o app volta pro
// primeiro plano, não só na abertura fria.
export function BiometricLockGate() {
  const { signOut } = useAuth();
  const [locked, setLocked] = useState(() => isBiometricLockEnabled());
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // addResumeListener exige que checkBiometry() já tenha rodado antes.
    BiometricAuth.checkBiometry()
      .then(() => {
        BiometricAuth.addResumeListener(() => {
          if (isBiometricLockEnabled()) {
            setLocked(true);
            setError(null);
          }
        });
      })
      .catch(() => {
        // Sem hardware/API de biometria disponível — a trava nunca devia
        // ter sido ativada nesse aparelho, mas se ficou marcada mesmo
        // assim (ex.: config antiga), não bloqueia o app sem saída.
      });

    if (isBiometricLockEnabled()) unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock() {
    setChecking(true);
    setError(null);
    try {
      await BiometricAuth.authenticate({
        reason: 'Desbloqueie para acessar o Personal Gym Control',
        cancelTitle: 'Cancelar',
        allowDeviceCredential: true,
      });
      setLocked(false);
    } catch {
      setError('Não foi possível confirmar sua digital. Tente novamente.');
    } finally {
      setChecking(false);
    }
  }

  if (!locked) return <Outlet />;

  return (
    <div className="biometric-lock-screen">
      <div className="biometric-lock-icon">
        <Fingerprint size={36} />
      </div>
      <h1>App bloqueado</h1>
      <p>Desbloqueie com sua digital para continuar.</p>
      {error && <p className="biometric-lock-error">{error}</p>}
      <button type="button" className="biometric-unlock-btn" onClick={unlock} disabled={checking}>
        {checking ? 'Verificando...' : 'Desbloquear'}
      </button>
      <button type="button" className="biometric-lock-signout" onClick={() => signOut()}>
        <LogOut size={13} />
        Sair
      </button>
    </div>
  );
}
