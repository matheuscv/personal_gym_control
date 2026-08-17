import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LogOut, Settings2, Smartphone, UserRound, UserRoundPlus } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import './UserMenu.css';

const IS_ANDROID = import.meta.env.VITE_PLATFORM === 'android';
const ANDROID_APK_URL =
  'https://github.com/matheuscv/personal_gym_control/releases/download/android-apk/personal-gym-control.apk';
const ANDROID_RELEASE_API_URL =
  'https://api.github.com/repos/matheuscv/personal_gym_control/releases/tags/android-apk';

// A tag da release é fixa ("android-apk") e o asset é sempre sobrescrito a
// cada build — a versão real (1.0.<run_number>) só aparece no "name" da
// release, algo como "App Android — build 32".
async function fetchLatestAndroidVersion(): Promise<string | null> {
  const res = await fetch(ANDROID_RELEASE_API_URL);
  if (!res.ok) return null;
  const data = (await res.json()) as { name?: string };
  const match = typeof data.name === 'string' ? data.name.match(/build\s+(\d+)/i) : null;
  return match ? `1.0.${match[1]}` : null;
}

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

  const androidVersionQuery = useQuery({
    queryKey: ['android-apk-version'],
    queryFn: fetchLatestAndroidVersion,
    enabled: !IS_ANDROID && open,
    staleTime: 1000 * 60 * 60,
    retry: 2,
  });

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
          <div className="user-menu-header">
            <span className="user-menu-header-avatar">{initials}</span>
            <span className="user-menu-header-text">
              <span className="user-menu-header-name">{label}</span>
              {user?.email && user.email !== label && (
                <span className="user-menu-header-email">{user.email}</span>
              )}
            </span>
          </div>

          <Link to="/conta" role="menuitem" className="user-menu-item" onClick={close}>
            <span className="user-menu-item-icon">
              <UserRound size={15} />
            </span>
            Minha conta
          </Link>
          <Link to="/admin" role="menuitem" className="user-menu-item" onClick={close}>
            <span className="user-menu-item-icon">
              <Settings2 size={15} />
            </span>
            Configuração
          </Link>
          <Link to="/convidar" role="menuitem" className="user-menu-item" onClick={close}>
            <span className="user-menu-item-icon">
              <UserRoundPlus size={15} />
            </span>
            Convidar alguém
          </Link>

          {!IS_ANDROID && (
            <>
              <span className="user-menu-divider" />
              <a
                href={ANDROID_APK_URL}
                role="menuitem"
                className="user-menu-item"
                onClick={close}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="user-menu-item-icon">
                  <Smartphone size={15} />
                </span>
                Baixar app Android
                {androidVersionQuery.data && (
                  <span className="user-menu-item-version">(v{androidVersionQuery.data})</span>
                )}
              </a>
            </>
          )}

          <span className="user-menu-divider" />
          <button
            type="button"
            role="menuitem"
            className="user-menu-item user-menu-signout"
            onClick={() => {
              close();
              signOut();
            }}
          >
            <span className="user-menu-item-icon">
              <LogOut size={15} />
            </span>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
