import { Link, Outlet, useLocation } from 'react-router-dom';
import { CalendarDays, ChevronDown, ClipboardList, HeartPulse, SlidersHorizontal, Target } from 'lucide-react';
import './admin.css';

interface AdminNavChild {
  to: string;
  label: string;
}

interface AdminNavArea {
  to: string;
  label: string;
  icon: typeof Target;
  matchPrefixes: string[];
  children?: AdminNavChild[];
}

// Meus Planos e Meus Relatórios (CRUD/importador) continuam exclusivos
// da web — no Android, Configuração só mostra Meu Objetivo e Meu Treino.
const IS_ANDROID = import.meta.env.VITE_PLATFORM === 'android';

const ADMIN_NAV: AdminNavArea[] = [
  { to: '/admin/goal', label: 'Meu Objetivo', icon: Target, matchPrefixes: ['/admin/goal'] },
  { to: '/admin/schedule', label: 'Meu Treino', icon: CalendarDays, matchPrefixes: ['/admin/schedule'] },
  ...(IS_ANDROID
    ? []
    : [
        {
          to: '/admin/plans',
          label: 'Meus Planos',
          icon: ClipboardList,
          matchPrefixes: ['/admin/plans', '/admin/import', '/admin/create-plan'],
          children: [
            { to: '/admin/import', label: 'Importar Plano' },
            { to: '/admin/create-plan', label: 'Criar Plano' },
          ],
        },
        {
          to: '/admin/body-report',
          label: 'Meus Relatórios',
          icon: HeartPulse,
          matchPrefixes: ['/admin/body-report'],
          children: [
            { to: '/admin/body-report/import', label: 'Importar Relatório' },
            { to: '/admin/body-report/create', label: 'Criar Relatório' },
          ],
        },
      ]),
];

function isPrefixActive(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function AdminLayout() {
  const { pathname } = useLocation();

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <span className="admin-eyebrow">Painel do atleta</span>
        <h1 className="admin-title">
          <SlidersHorizontal size={22} />
          Configuração
        </h1>
      </header>

      <nav className="admin-nav-groups">
        {ADMIN_NAV.map((area) => {
          const Icon = area.icon;
          const isActive = area.matchPrefixes.some((prefix) => isPrefixActive(pathname, prefix));
          const hasChildren = !!area.children;
          return (
            <div
              key={area.to}
              className="admin-nav-group"
              data-has-children={hasChildren}
              data-active={isActive}
            >
              <Link to={area.to} className="admin-nav-tile" aria-current={isActive ? 'page' : undefined}>
                <Icon size={16} />
                <span>{area.label}</span>
                {hasChildren && <ChevronDown size={13} className="admin-nav-chevron" />}
              </Link>
              {hasChildren && isActive && (
                <div className="admin-nav-children">
                  {area.children!.map((child) => (
                    <Link
                      key={child.to}
                      to={child.to}
                      className={`admin-nav-child ${pathname.startsWith(child.to) ? 'active' : ''}`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <Outlet />
    </section>
  );
}
