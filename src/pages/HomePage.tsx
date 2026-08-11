import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { DailyWorkoutPage } from '../features/workout/DailyWorkoutPage';

const IS_ANDROID = import.meta.env.VITE_PLATFORM === 'android';

export function HomePage() {
  const { user, signOut } = useAuth();

  return (
    <section className="home-page">
      <header className="home-header">
        <span>{user?.email}</span>
        <div className="home-header-actions">
          <Link to="/evolucao">Evolução</Link>
          {!IS_ANDROID && <Link to="/admin">Admin</Link>}
          <button type="button" onClick={() => signOut()}>
            Sair
          </button>
        </div>
      </header>
      <h1>Treino do dia</h1>
      <DailyWorkoutPage />
    </section>
  );
}
