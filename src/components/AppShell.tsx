import { Link, NavLink, Outlet } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import { UserMenu } from './UserMenu';
import './AppShell.css';

const IS_ANDROID = import.meta.env.VITE_PLATFORM === 'android';

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/treino', label: 'Treino do dia' },
  { to: '/evolucao', label: 'Evolução Treino' },
  { to: '/evolucao-corporal', label: 'Evolução Corporal' },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <div className="app-header-sticky">
        <header className="app-topbar">
          <Link to="/" className="app-brand">
            <Dumbbell size={22} />
            <span>Personal Gym Control</span>
          </Link>
          <div className="app-topbar-controls">
            {IS_ANDROID && (
              <span className="app-version" title={`Commit ${__APP_COMMIT__}`}>
                v{__APP_VERSION__}
              </span>
            )}
            <ThemeToggle />
            <UserMenu />
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
        </nav>
      </div>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
