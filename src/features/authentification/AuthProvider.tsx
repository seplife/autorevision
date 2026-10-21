import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { appConfig } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import { fetchAccount, type AccountSnapshot } from '@/repositories/account';
import type { AppRole } from '@/types/domain';

interface AuthValue {
  /** Vrai tant que la session initiale n'a pas été lue. */
  initializing: boolean;
  session: Session | null;
  account: AccountSnapshot | undefined;
  accountLoading: boolean;
  accountError: unknown;
  roles: AppRole[];
  /** Vrai après un clic sur le lien de réinitialisation reçu par e-mail. */
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  refreshAccount: () => Promise<unknown>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(appConfig.configured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!appConfig.configured) return;
    const sb = getSupabase();
    let active = true;
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .finally(() => {
        if (active) setInitializing(false);
      });
    const { data: sub } = sb.auth.onAuthStateChange((event: AuthChangeEvent, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id ?? null;
  const accountQuery = useQuery({
    queryKey: ['account', userId],
    queryFn: () => fetchAccount(userId as string),
    enabled: userId !== null,
    staleTime: 5 * 60_000,
  });

  const signOut = useCallback(async () => {
    // Le serveur révoque le jeton ; en cas d'échec réseau, la session locale est
    // tout de même effacée par supabase-js (scope local).
    await getSupabase().auth.signOut({ scope: 'local' });
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      initializing,
      session,
      account: accountQuery.data,
      accountLoading: accountQuery.isLoading,
      accountError: accountQuery.error,
      roles: accountQuery.data?.roles ?? [],
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),
      refreshAccount: () => accountQuery.refetch(),
      signOut,
    }),
    [initializing, session, accountQuery, passwordRecovery, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider.');
  return ctx;
}

/** Variante pour les tests : fournit une valeur d'authentification arbitraire. */
export const AuthContextForTests = AuthContext;
