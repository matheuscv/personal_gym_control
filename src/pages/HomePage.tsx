import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { DailyWorkoutPage } from '../features/workout/DailyWorkoutPage';

export function HomePage() {
  const { user, signOut } = useAuth();

  return (
    <section className="home-page">
      <header className="home-header">
        <span>{user?.email}</span>
        <div className="home-header-actions">
          <Link to="/admin">Admin</Link>
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
