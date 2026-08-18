import { lazy, Suspense } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth-context';

// Trava por digital só existe no bundle Android — na web a sessão do
// Supabase já basta (ver BiometricLockGate). import() dinâmico guardado
// por essa constante deixa o Rollup eliminar o plugin nativo do bundle
// web (mesmo padrão das telas exclusivas do Android em App.tsx).
const IS_ANDROID = import.meta.env.VITE_PLATFORM === 'android';

const BiometricLockGate = IS_ANDROID
  ? lazy(() => import('./BiometricLockGate').then((m) => ({ default: m.BiometricLockGate })))
  : null;

export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <p className="auth-loading">Carregando...</p>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (BiometricLockGate) {
    return (
      <Suspense fallback={<p className="auth-loading">Carregando...</p>}>
        <BiometricLockGate />
      </Suspense>
    );
  }

  return <Outlet />;
}
