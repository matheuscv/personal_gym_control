import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth-context';

export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <p className="auth-loading">Carregando...</p>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
