import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContextForTests } from '@/features/authentification/AuthProvider';
import { RequireAuth, RequireRole } from '@/features/authentification/guards';
import type { AppRole } from '@/types/domain';

type AuthValue = React.ContextType<typeof AuthContextForTests>;

function authValue(overrides: Partial<NonNullable<AuthValue>>): NonNullable<AuthValue> {
  return {
    initializing: false,
    session: null,
    account: undefined,
    accountLoading: false,
    accountError: null,
    roles: [],
    passwordRecovery: false,
    clearPasswordRecovery: () => undefined,
    refreshAccount: async () => undefined,
    signOut: async () => undefined,
    ...overrides,
  };
}

const fakeSession = { user: { id: 'u1' } } as unknown as Session;

function renderAt(path: string, value: NonNullable<AuthValue>, allowed: AppRole[] = ['administrateur']) {
  return render(
    <AuthContextForTests.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole allowed={allowed} />}>
              <Route path="/administration" element={<p>Zone admin</p>} />
            </Route>
          </Route>
          <Route path="/connexion" element={<p>Page de connexion</p>} />
          <Route path="/acces-refuse" element={<p>Accès refusé</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContextForTests.Provider>,
  );
}

describe('gardes de routes', () => {
  it('redirige vers la connexion sans session', () => {
    renderAt('/administration', authValue({}));
    expect(screen.getByText('Page de connexion')).toBeInTheDocument();
  });

  it('affiche un état de chargement pendant la lecture de la session', () => {
    renderAt('/administration', authValue({ initializing: true }));
    expect(screen.getByRole('status')).toHaveTextContent(/session/i);
  });

  it('refuse un rôle non autorisé', () => {
    renderAt('/administration', authValue({ session: fakeSession, roles: ['eleve'] }));
    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
  });

  it('laisse passer un rôle autorisé', () => {
    renderAt('/administration', authValue({ session: fakeSession, roles: ['administrateur'] }));
    expect(screen.getByText('Zone admin')).toBeInTheDocument();
  });

  it('affiche une erreur compréhensible si le compte ne peut pas être chargé', () => {
    renderAt('/administration', authValue({ session: fakeSession, accountError: new TypeError('Failed to fetch') }));
    expect(screen.getByRole('alert')).toHaveTextContent(/injoignable/);
  });
});
