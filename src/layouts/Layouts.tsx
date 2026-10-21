import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usePlatform } from '@/app/usePlatform';
import { useTheme, type ThemePreference } from '@/app/theme';
import { InstallButton } from '@/app/pwa';
import { useAuth } from '@/features/authentification/AuthProvider';
import { navigationForRoles } from '@/features/authentification/roles';
import { ConnectivityIndicator } from '@/features/connectivite/ConnectivityIndicator';

function Brand() {
  const { platform_name } = usePlatform();
  return (
    <Link to="/" className="flex min-h-11 items-center gap-2 font-bold text-white">
      <img src="/icons/favicon.svg" alt="" className="size-8" width="32" height="32" />
      <span className="text-lg leading-tight">{platform_name}</span>
    </Link>
  );
}

function SkipLink() {
  return (
    <a
      href="#contenu"
      className="sr-only rounded bg-white px-3 py-2 font-semibold text-marine-900 focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
    >
      Aller au contenu
    </a>
  );
}

export function ThemeSelect({ id = 'theme' }: { id?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm">
      <span>Thème</span>
      <select
        id={id}
        value={preference}
        onChange={(e) => setPreference(e.target.value as ThemePreference)}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-slate-900 dark:border-marine-600 dark:bg-marine-900 dark:text-white"
      >
        <option value="systeme">Selon l’appareil</option>
        <option value="clair">Clair</option>
        <option value="sombre">Sombre</option>
      </select>
    </label>
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block min-h-11 rounded-lg px-3 py-2.5 font-medium ${
    isActive
      ? 'bg-marine-100 text-marine-900 dark:bg-marine-800 dark:text-white'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-marine-900'
  }`;

export function PublicLayout() {
  const { session } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="bg-marine-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Brand />
          <nav aria-label="Navigation publique" className="flex flex-wrap items-center gap-1 text-white">
            <NavLink to="/presentation" className="min-h-11 rounded-lg px-3 py-2.5 hover:bg-white/10">
              Présentation
            </NavLink>
            {session ? (
              <NavLink to="/espace" className="min-h-11 rounded-lg bg-ciel-400 px-3 py-2.5 font-semibold text-marine-950">
                Mon espace
              </NavLink>
            ) : (
              <>
                <NavLink to="/connexion" className="min-h-11 rounded-lg px-3 py-2.5 hover:bg-white/10">
                  Connexion
                </NavLink>
                <NavLink to="/inscription" className="min-h-11 rounded-lg bg-ciel-400 px-3 py-2.5 font-semibold text-marine-950">
                  Créer un compte
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="contenu" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

function PublicFooter() {
  const { slogan, platform_name } = usePlatform();
  return (
    <footer className="border-t border-slate-200 py-6 text-sm text-slate-600 dark:border-marine-800 dark:text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
        <p>
          {platform_name} — {slogan}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/confidentialite" className="underline">
            Confidentialité
          </Link>
          <ThemeSelect id="theme-footer" />
        </div>
      </div>
    </footer>
  );
}

export function AppLayout() {
  const { roles, account, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = navigationForRoles(roles);

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="sticky top-0 z-40 bg-marine-900 shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
          <Brand />
          <div className="flex items-center gap-1">
            <ConnectivityIndicator />
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white hover:bg-white/10 md:hidden"
              aria-expanded={menuOpen}
              aria-controls="menu-principal"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="sr-only">{menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col md:flex-row md:gap-6 md:px-4 md:py-6">
        <nav
          id="menu-principal"
          aria-label="Navigation principale"
          className={`${menuOpen ? 'block' : 'hidden'} border-b border-slate-200 bg-white p-3 md:block md:w-60 md:shrink-0 md:rounded-xl md:border md:self-start dark:border-marine-800 dark:bg-marine-950 md:dark:bg-marine-900`}
        >
          {account?.profile && (
            <p className="mb-2 truncate px-3 text-sm text-slate-600 dark:text-slate-300">
              Connecté : <strong>{account.profile.display_name}</strong>
            </p>
          )}
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end className={navLinkClass} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-marine-800">
            <InstallButton />
            <button
              type="button"
              className="block min-h-11 w-full rounded-lg px-3 py-2.5 text-left font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
              onClick={async () => {
                await signOut();
                navigate('/connexion', { replace: true });
              }}
            >
              Se déconnecter
            </button>
          </div>
        </nav>
        <main id="contenu" className="flex-1 px-4 py-6 md:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
