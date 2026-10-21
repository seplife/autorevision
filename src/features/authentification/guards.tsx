import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Alert } from '@/components/Alert';
import { LoadingScreen } from '@/components/Loading';
import { messageErreur } from '@/lib/errors';
import type { AppRole } from '@/types/domain';
import { useAuth } from './AuthProvider';
import { hasAnyRole, homePathForRoles } from './roles';

/** Exige une session. Le contrôle réel des données reste la RLS côté serveur. */
export function RequireAuth() {
  const { initializing, session, accountLoading, accountError } = useAuth();
  const location = useLocation();
  if (initializing) return <LoadingScreen label="Vérification de la session…" />;
  if (!session) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  }
  if (accountLoading) return <LoadingScreen label="Chargement de votre compte…" />;
  if (accountError) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <Alert tone="error" title="Impossible de charger votre compte">
          {messageErreur(accountError)}
        </Alert>
      </div>
    );
  }
  return <Outlet />;
}

/** Restreint une zone de l'interface à certains rôles (confort d'interface, pas sécurité). */
export function RequireRole({ allowed }: { allowed: readonly AppRole[] }) {
  const { roles } = useAuth();
  if (!hasAnyRole(roles, allowed)) {
    return <Navigate to="/acces-refuse" replace />;
  }
  return <Outlet />;
}

/** Redirige un utilisateur déjà connecté vers son espace (pages connexion / inscription). */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { initializing, session, roles, accountLoading } = useAuth();
  if (initializing || (session && accountLoading)) return <LoadingScreen label="Chargement…" />;
  if (session) return <Navigate to={homePathForRoles(roles)} replace />;
  return <>{children}</>;
}
