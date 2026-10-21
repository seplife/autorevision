import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { TextField } from '@/components/Field';
import { ThemeSelect } from '@/layouts/Layouts';
import { useAuth } from '@/features/authentification/AuthProvider';
import { useConnectivity } from '@/features/connectivite/ConnectivityProvider';
import { STATUS_LABELS } from '@/features/connectivite/connectivity';
import { messageErreur } from '@/lib/errors';
import { updateDisplayName } from '@/repositories/account';
import { ROLE_LABELS } from '@/types/domain';

export default function Parametres() {
  const { session, account, roles, refreshAccount } = useAuth();
  const { status, lastServerContact } = useConnectivity();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  useEffect(() => setName(account?.profile?.display_name ?? ''), [account?.profile?.display_name]);

  const save = useMutation({
    mutationFn: (n: string) => updateDisplayName(session!.user.id, n),
    onSuccess: () => void refreshAccount(),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) return setNameError('Le nom doit contenir entre 2 et 80 caractères.');
    setNameError(null);
    save.mutate(trimmed);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Paramètres et aide" />
      <Card title="Mon compte">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          {session?.user.email} — {roles.map((r) => ROLE_LABELS[r]).join(', ') || 'aucun rôle'}
        </p>
        <form onSubmit={onSubmit} noValidate className="space-y-3">
          {save.error && <Alert tone="error">{messageErreur(save.error)}</Alert>}
          {save.isSuccess && <Alert tone="success">Nom enregistré.</Alert>}
          <TextField label="Nom affiché" value={name} onChange={(e) => setName(e.target.value)} error={nameError ?? undefined} autoComplete="name" />
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
        </form>
      </Card>
      <Card title="Affichage">
        <ThemeSelect id="theme-parametres" />
      </Card>
      <Card title="Connexion et fonctionnement hors ligne">
        <p>
          État actuel : <strong>{STATUS_LABELS[status]}</strong>
          {lastServerContact &&
            ` — dernier contact avec le serveur à ${lastServerContact.toLocaleTimeString('fr-CI', { timeZone: 'Africa/Abidjan' })}`}
          .
        </p>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          Une fois l’application ouverte une première fois avec Internet, ses écrans s’ouvrent sans connexion. Le
          téléchargement des cours pour une utilisation hors ligne et l’enregistrement des réponses sans réseau arriveront
          avec les modules « Téléchargements » et « Synchronisation ». L’espace de stockage disponible dépend de votre
          appareil et de votre navigateur.
        </p>
      </Card>
      <Card title="Confidentialité">
        <p>
          Consultez la <Link to="/confidentialite" className="underline">politique de confidentialité</Link>. Pour corriger
          ou supprimer vos données, contactez l’administration de la plateforme.
        </p>
      </Card>
    </div>
  );
}
