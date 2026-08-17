import { Link, NavLink, Outlet } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import { UserMenu } from './UserMenu';
import './AppShell.css';

// Evolução Treino depende de dados que só se configuram em Configuração
// (admin), área exclusiva da web — por isso fica sempre indisponível no
// Android, não é uma limitação temporária. Evolução Corporal já foi
// liberada pro Android.
const IS_ANDROID = import.meta.env.VITE_PLATFORM === 'android';
const ANDROID_UNAVAILABLE_HINT = 'Disponível apenas na versão web';

const NAV_ITEMS: { to: string; label: string; end?: boolean; disabled?: boolean }[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/treino', label: 'Treino do dia' },
  { to: '/evolucao', label: 'Evolução Treino', disabled: IS_ANDROID },
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
          {NAV_ITEMS.map((item) =>
            item.disabled ? (
              <span key={item.to} className="nav-disabled" title={ANDROID_UNAVAILABLE_HINT}>
                {item.label}
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {item.label}
              </NavLink>
            )
          )}
        </nav>
      </div>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
