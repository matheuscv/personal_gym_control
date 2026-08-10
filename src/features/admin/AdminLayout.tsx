import { NavLink, Outlet } from 'react-router-dom';
import './admin.css';

export function AdminLayout() {
  return (
    <section className="admin-page">
      <header className="admin-header">
        <NavLink to="/" className="back-link">
          ← Treino do dia
        </NavLink>
        <nav className="admin-nav">
          <NavLink to="/admin/exercises" className={({ isActive }) => (isActive ? 'active' : '')}>
            Exercícios
          </NavLink>
          <NavLink to="/admin/plans" className={({ isActive }) => (isActive ? 'active' : '')}>
            Planos
          </NavLink>
        </nav>
      </header>
      <Outlet />
    </section>
  );
}
