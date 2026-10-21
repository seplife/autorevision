import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { messageErreur } from '@/lib/errors';
import { createParentLinkCode, listFamilyLinks, revokeFamilyLink } from '@/repositories/family';
import type { FamilyLink } from '@/types/domain';

const formatDate = (d: Date | string) =>
  new Date(d).toLocaleString('fr-CI', { timeZone: 'Africa/Abidjan', dateStyle: 'long', timeStyle: 'short' });

export function LinkedPeopleList({ relationLabel }: { relationLabel: string }) {
  const queryClient = useQueryClient();
  const links = useQuery({ queryKey: ['family-links'], queryFn: listFamilyLinks });
  const [toRevoke, setToRevoke] = useState<FamilyLink | null>(null);
  const revoke = useMutation({
    mutationFn: (id: string) => revokeFamilyLink(id),
    onSuccess: () => {
      setToRevoke(null);
      void queryClient.invalidateQueries({ queryKey: ['family-links'] });
    },
  });

  if (links.isLoading) return <p>Chargement…</p>;
  if (links.error) return <Alert tone="error">{messageErreur(links.error)}</Alert>;
  if ((links.data?.length ?? 0) === 0) return <p className="text-slate-700 dark:text-slate-300">Aucun lien actif.</p>;

  return (
    <>
      {revoke.error && <Alert tone="error">{messageErreur(revoke.error)}</Alert>}
      <ul className="divide-y divide-slate-200 dark:divide-marine-800">
        {links.data?.map((l) => (
          <li key={l.link_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-semibold">{l.other_display_name}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">Lié le {formatDate(l.linked_at)}</p>
            </div>
            <Button variant="secondary" onClick={() => setToRevoke(l)}>
              Retirer ce lien
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={toRevoke !== null}
        title="Retirer ce lien ?"
        message={`${toRevoke?.other_display_name ?? ''} ne pourra plus voir les informations liées à ce ${relationLabel}. Un nouveau code sera nécessaire pour rétablir le lien.`}
        confirmLabel="Retirer le lien"
        danger
        loading={revoke.isPending}
        onConfirm={() => toRevoke && revoke.mutate(toRevoke.link_id)}
        onCancel={() => setToRevoke(null)}
      />
    </>
  );
}

export default function LiaisonParents() {
  const [generated, setGenerated] = useState<{ code: string; expiresAt: Date } | null>(null);
  const create = useMutation({ mutationFn: createParentLinkCode, onSuccess: setGenerated });

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title="Mes parents"
        description="Pour que ton parent ou tuteur suive ta progression, génère un code et donne-le-lui. Il le saisira dans son propre compte."
      />
      <Card title="Générer un code de liaison">
        {create.error && <Alert tone="error">{messageErreur(create.error)}</Alert>}
        {generated ? (
          <div className="space-y-3">
            <p>Donne ce code à ton parent ou tuteur, et à personne d’autre :</p>
            <p className="select-all rounded-lg bg-marine-50 py-4 text-center font-mono text-3xl font-bold tracking-widest text-marine-900 dark:bg-marine-800 dark:text-white" aria-label={`Code : ${generated.code.split('').join(' ')}`}>
              {generated.code}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Valable une seule fois, jusqu’au {formatDate(generated.expiresAt)}. Ce code ne sera plus affiché après avoir
              quitté cette page.
            </p>
          </div>
        ) : (
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Générer un nouveau code annule le précédent s’il n’a pas encore été utilisé.
          </p>
        )}
        <Button className="mt-3" onClick={() => create.mutate()} loading={create.isPending} variant={generated ? 'secondary' : 'primary'}>
          {generated ? 'Générer un autre code' : 'Générer un code'}
        </Button>
      </Card>
      <Card title="Parents liés à mon compte">
        <LinkedPeopleList relationLabel="compte" />
      </Card>
    </div>
  );
}
