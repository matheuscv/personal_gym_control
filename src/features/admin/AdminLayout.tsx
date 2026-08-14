import { NavLink, Outlet } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import './admin.css';

export function AdminLayout() {
  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <span className="admin-eyebrow">Painel do atleta</span>
        <h1 className="admin-title">
          <SlidersHorizontal size={22} />
          Configuração
        </h1>
      </header>
      <nav className="admin-nav">
        <NavLink to="/admin/goal" className={({ isActive }) => (isActive ? 'active' : '')}>
          Meu Objetivo
        </NavLink>
        <NavLink to="/admin/schedule" className={({ isActive }) => (isActive ? 'active' : '')}>
          Meu Treino
        </NavLink>
        <NavLink to="/admin/plans" className={({ isActive }) => (isActive ? 'active' : '')}>
          Planos
        </NavLink>
        <NavLink to="/admin/import" className={({ isActive }) => (isActive ? 'active' : '')}>
          Importar Plano
        </NavLink>
        <NavLink to="/admin/create-plan" className={({ isActive }) => (isActive ? 'active' : '')}>
          Criar Plano
        </NavLink>
        <NavLink to="/admin/body-report" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Relatórios
        </NavLink>
        <NavLink to="/admin/body-report/import" className={({ isActive }) => (isActive ? 'active' : '')}>
          Importar Relatório
        </NavLink>
        <NavLink to="/admin/body-report/create" className={({ isActive }) => (isActive ? 'active' : '')}>
          Criar Relatório
        </NavLink>
      </nav>
      <Outlet />
    </section>
  );
}
