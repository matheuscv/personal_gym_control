import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import './AppShell.css';

const IS_ANDROID = import.meta.env.VITE_PLATFORM === 'android';

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/treino', label: 'Treino do dia' },
  { to: '/evolucao', label: 'Evolução Treino' },
  { to: '/evolucao-corporal', label: 'Evolução Corporal' },
];

export function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <div className="app-shell">
      <div className="app-header-sticky">
        <header className="app-topbar">
          <span className="app-eyebrow">Personal Gym Control</span>
          <div className="app-topbar-user">
            <span className="app-user-email">{user?.email}</span>
            <button type="button" onClick={() => signOut()}>
              Sair
            </button>
          </div>
        </header>
        <nav className="app-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
          {!IS_ANDROID && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
              Admin
            </NavLink>
          )}
        </nav>
      </div>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
