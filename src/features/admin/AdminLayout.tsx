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
          <NavLink to="/admin/import" className={({ isActive }) => (isActive ? 'active' : '')}>
            Importar JSON
          </NavLink>
          <NavLink to="/admin/body-report" className={({ isActive }) => (isActive ? 'active' : '')}>
            Relatório Corporal
          </NavLink>
          <NavLink to="/admin/body-report/import" className={({ isActive }) => (isActive ? 'active' : '')}>
            Importar Relatório
          </NavLink>
        </nav>
      </header>
      <Outlet />
    </section>
  );
}
