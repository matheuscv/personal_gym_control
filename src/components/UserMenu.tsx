import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, User, UserPlus } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import './UserMenu.css';

function initialsFor(email: string | undefined, displayName: unknown): string {
  const name = typeof displayName === 'string' && displayName.trim() ? displayName.trim() : email;
  if (!name) return '?';
  const parts = name.split(/[\s@]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const displayName = user?.user_metadata?.display_name;
  const label = typeof displayName === 'string' && displayName.trim() ? displayName.trim() : user?.email;
  const initials = initialsFor(user?.email, displayName);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="user-menu-avatar">{initials}</span>
        <span className="user-menu-label">{label}</span>
        <ChevronDown size={16} className={`user-menu-chevron ${open ? 'open' : ''}`} />
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <Link to="/conta" role="menuitem" className="user-menu-item" onClick={close}>
            <User size={16} />
            Minha conta
          </Link>
          <Link to="/admin" role="menuitem" className="user-menu-item" onClick={close}>
            <Settings size={16} />
            Configuração
          </Link>
          <Link to="/convidar" role="menuitem" className="user-menu-item" onClick={close}>
            <UserPlus size={16} />
            Convidar alguém
          </Link>
          <button
            type="button"
            role="menuitem"
            className="user-menu-item user-menu-signout"
            onClick={() => {
              close();
              signOut();
            }}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
