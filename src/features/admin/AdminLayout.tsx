import { NavLink, Outlet } from 'react-router-dom';
import './admin.css';

export function AdminLayout() {
  return (
    <section className="admin-page">
      <h1>Configuração</h1>
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
        <NavLink to="/admin/body-report" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Relatório Corporal
        </NavLink>
        <NavLink to="/admin/body-report/import" className={({ isActive }) => (isActive ? 'active' : '')}>
          Importar Relatório
        </NavLink>
      </nav>
      <Outlet />
    </section>
  );
}
