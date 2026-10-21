import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SelectField, TextField } from '@/components/Field';
import { useAuth } from '@/features/authentification/AuthProvider';
import { messageErreur } from '@/lib/errors';
import { decideRoleRequest, grantRole, listRoleRequests, listUsers, revokeRole, type RoleRequestRow } from '@/repositories/administration';
import { APP_ROLES, ROLE_LABELS, type AdminUserRow, type AppRole } from '@/types/domain';

const PAGE_SIZE = 25;

type PendingChange = { user: AdminUserRow; role: AppRole; action: 'grant' | 'revoke' };

function useDebounced<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function DemandesRole() {
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ['role-requests'], queryFn: listRoleRequests });
  const [pending, setPending] = useState<{ req: RoleRequestRow; approve: boolean } | null>(null);
  const decide = useMutation({
    mutationFn: (p: { req: RoleRequestRow; approve: boolean }) => decideRoleRequest(p.req.id, p.approve),
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ['role-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => setPending(null),
  });

  if (requests.error) return <Alert tone="error">{messageErreur(requests.error)}</Alert>;
  if (!requests.data || requests.data.length === 0) return null;

  return (
    <Card title={`Demandes de rôle en attente (${requests.data.length})`}>
      {decide.error && <Alert tone="error">{messageErreur(decide.error)}</Alert>}
      <ul className="divide-y divide-slate-200 dark:divide-marine-800">
        {requests.data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">
                {r.display_name} — {ROLE_LABELS[r.requested_role]}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {r.email} · demandé le {new Date(r.created_at).toLocaleDateString('fr-CI', { timeZone: 'Africa/Abidjan' })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="success" onClick={() => setPending({ req: r, approve: true })}>
                Approuver
              </Button>
              <Button variant="secondary" onClick={() => setPending({ req: r, approve: false })}>
                Refuser
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={pending !== null}
        title={pending?.approve ? 'Approuver cette demande ?' : 'Refuser cette demande ?'}
        message={
          pending
            ? pending.approve
              ? `${pending.req.display_name} recevra le rôle « ${ROLE_LABELS[pending.req.requested_role]} » et les droits associés. Vérifiez son identité avant d’approuver.`
              : `La demande de ${pending.req.display_name} sera refusée. Son compte restera sans rôle.`
            : ''
        }
        confirmLabel={pending?.approve ? 'Approuver' : 'Refuser'}
        danger={pending?.approve === false}
        loading={decide.isPending}
        onConfirm={() => pending && decide.mutate(pending)}
        onCancel={() => setPending(null)}
      />
    </Card>
  );
}

export default function GestionUtilisateurs() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const debounced = useDebounced(search);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [roleToAdd, setRoleToAdd] = useState<Record<string, AppRole | ''>>({});

  useEffect(() => setPage(0), [debounced]);

  const users = useQuery({
    queryKey: ['admin-users', debounced, page],
    queryFn: () => listUsers(debounced, page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  const change = useMutation({
    mutationFn: (c: PendingChange) => (c.action === 'grant' ? grantRole(c.user.id, c.role) : revokeRole(c.user.id, c.role)),
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Utilisateurs et rôles"
        description="Chaque modification est contrôlée par le serveur et inscrite au journal d’audit. Vous ne pouvez pas modifier vos propres rôles."
      />
      <DemandesRole />
      <Card>
        <TextField label="Rechercher (nom ou e-mail)" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>
      {users.error && <Alert tone="error">{messageErreur(users.error)}</Alert>}
      {change.error && <Alert tone="error">{messageErreur(change.error)}</Alert>}
      <Card>
        {users.isLoading ? (
          <p>Chargement…</p>
        ) : (users.data?.length ?? 0) === 0 ? (
          <p>Aucun compte ne correspond.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-marine-800">
            {users.data?.map((u) => {
              const isSelf = u.id === session?.user.id;
              const available = APP_ROLES.filter((r) => !u.roles.includes(r));
              const selected = roleToAdd[u.id] ?? '';
              return (
                <li key={u.id} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {u.display_name} {isSelf && <span className="text-sm font-normal">(vous)</span>}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{u.email}</p>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Inscrit le {new Date(u.created_at).toLocaleDateString('fr-CI', { timeZone: 'Africa/Abidjan' })}
                    </p>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Rôles de ${u.display_name}`}>
                    {u.roles.length === 0 && <li className="text-sm italic">Aucun rôle</li>}
                    {u.roles.map((r) => (
                      <li key={r} className="inline-flex items-center gap-1 rounded-full bg-marine-50 py-1 pl-3 pr-1 text-sm dark:bg-marine-800">
                        {ROLE_LABELS[r]}
                        {!isSelf && (
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900"
                            onClick={() => setPending({ user: u, role: r, action: 'revoke' })}
                          >
                            <span aria-hidden="true">×</span>
                            <span className="sr-only">
                              Retirer le rôle {ROLE_LABELS[r]} à {u.display_name}
                            </span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!isSelf && available.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="w-60">
                        <SelectField
                          label="Attribuer un rôle"
                          value={selected}
                          onChange={(e) => setRoleToAdd((s) => ({ ...s, [u.id]: e.target.value as AppRole | '' }))}
                        >
                          <option value="">— Choisir —</option>
                          {available.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </SelectField>
                      </div>
                      <Button
                        variant="secondary"
                        disabled={!selected}
                        onClick={() => selected && setPending({ user: u, role: selected, action: 'grant' })}
                      >
                        Attribuer
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Page précédente
          </Button>
          <span className="text-sm">Page {page + 1}</span>
          <Button variant="ghost" disabled={(users.data?.length ?? 0) < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
            Page suivante
          </Button>
        </div>
      </Card>
      <ConfirmDialog
        open={pending !== null}
        title={pending?.action === 'grant' ? 'Attribuer ce rôle ?' : 'Retirer ce rôle ?'}
        message={
          pending
            ? pending.action === 'grant'
              ? `${pending.user.display_name} recevra le rôle « ${ROLE_LABELS[pending.role]} » et les droits associés.`
              : `${pending.user.display_name} perdra le rôle « ${ROLE_LABELS[pending.role]} ». Ses données sont conservées.`
            : ''
        }
        confirmLabel={pending?.action === 'grant' ? 'Attribuer' : 'Retirer'}
        danger={pending?.action === 'revoke'}
        loading={change.isPending}
        onConfirm={() => {
          if (!pending) return;
          change.mutate(pending, {
            onSuccess: () => setRoleToAdd((s) => ({ ...s, [pending.user.id]: '' })),
          });
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
