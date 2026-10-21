import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { SelectField } from '@/components/Field';
import { useAuth } from '@/features/authentification/AuthProvider';
import { homePathForRoles } from '@/features/authentification/roles';
import { messageErreur } from '@/lib/errors';
import { fetchMyPendingRoleRequest, requestMyRole } from '@/repositories/administration';
import { ROLE_LABELS } from '@/types/domain';

/** Redirige vers l'espace correspondant aux rôles de l'utilisateur. */
export function EspaceRedirect() {
  const { roles } = useAuth();
  return <Navigate to={homePathForRoles(roles)} replace />;
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <PageHeader title="Page introuvable" description="Cette adresse ne correspond à aucune page de l’application." />
      <Link to="/" className="font-medium text-marine-700 underline dark:text-ciel-300">
        Revenir à l’accueil
      </Link>
    </div>
  );
}

export function AccesRefuse() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Accès non autorisé" />
      <Alert tone="warning">Votre compte ne dispose pas des droits nécessaires pour ouvrir cette page.</Alert>
      <Link to="/espace" className="mt-4 inline-block font-medium text-marine-700 underline dark:text-ciel-300">
        Revenir à mon espace
      </Link>
    </div>
  );
}

export function CompteEnAttente() {
  const { roles } = useAuth();
  const queryClient = useQueryClient();
  const request = useQuery({ queryKey: ['my-role-request'], queryFn: fetchMyPendingRoleRequest });
  const [selectedRole, setSelectedRole] = useState<'enseignant' | 'responsable_pedagogique'>('enseignant');

  const submit = useMutation({
    mutationFn: () => requestMyRole(selectedRole),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-role-request'] });
    },
  });

  if (roles.length > 0) {
    return <Navigate to={homePathForRoles(roles)} replace />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Compte en attente d’attribution" />
      {request.data ? (
        <Alert tone="info" title="Demande envoyée">
          Votre demande du rôle « {ROLE_LABELS[request.data]} » est en attente d’approbation par un administrateur.
          Reconnectez-vous ou actualisez la page une fois la demande approuvée.
        </Alert>
      ) : (
        <>
          <Alert tone="info">
            Votre compte existe mais aucun rôle ne lui est encore attribué. Si vous êtes enseignant ou membre de l’équipe
            pédagogique, soumettez une demande ci-dessous ou contactez un administrateur de la plateforme.
          </Alert>
          <Card title="Demander un rôle pédagogique">
            {submit.error && <Alert tone="error">{messageErreur(submit.error)}</Alert>}
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate();
              }}
            >
              <SelectField
                label="Rôle souhaité"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'enseignant' | 'responsable_pedagogique')}
              >
                <option value="enseignant">{ROLE_LABELS.enseignant}</option>
                <option value="responsable_pedagogique">{ROLE_LABELS.responsable_pedagogique}</option>
              </SelectField>
              <Button type="submit" loading={submit.isPending}>
                Envoyer ma demande
              </Button>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}

export function NonConfigure({ problems }: { problems: string[] }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <PageHeader title="Configuration requise" description="L’application n’est reliée à aucun serveur. Aucune donnée n’est simulée." />
      <Alert tone="error" title="Variables d’environnement manquantes ou invalides">
        <ul className="list-disc pl-5">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Alert>
      <p className="mt-4 text-slate-700 dark:text-slate-300">
        Copiez <code>.env.example</code> en <code>.env.local</code>, renseignez l’URL et la clé publique (anon) de votre
        projet Supabase, puis redémarrez le serveur de développement. Voir <code>docs/GUIDE_SUPABASE.md</code>.
      </p>
    </main>
  );
}

export function Confidentialite() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-slate-800 dark:text-slate-200">
      <PageHeader title="Politique de confidentialité" />
      <Alert tone="warning" title="Version provisoire">
        Ce texte décrit le fonctionnement technique actuel. Il doit être relu et complété au regard des obligations
        applicables en Côte d’Ivoire (protection des données personnelles, consentement parental, durées de conservation)
        avant tout lancement public.
      </Alert>
      <div className="mt-6 space-y-5">
        <section>
          <h2 className="text-lg font-bold">Données collectées</h2>
          <p className="mt-1">
            Adresse e-mail, nom affiché, type de compte, classe et série choisies, liens parent-enfant, et — dans les
            modules à venir — activités d’apprentissage et résultats. Aucune localisation n’est collectée. Les mots de
            passe sont gérés par Supabase Auth et ne sont jamais stockés en clair.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold">Qui peut voir quoi</h2>
          <p className="mt-1">
            Un élève ne voit que ses propres données. Un parent ne voit que les enfants qui lui ont transmis un code de
            liaison, tant que le lien n’est pas révoqué. Connaître le nom, la classe ou le numéro de téléphone d’un élève
            ne donne accès à aucune de ses données. Aucun classement individuel n’est publié.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold">Vos droits</h2>
          <p className="mt-1">
            Vous pouvez corriger votre nom depuis « Paramètres et aide », révoquer à tout moment un lien parent-enfant, et
            demander la suppression de votre compte auprès de l’administration de la plateforme.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold">Stockage sur l’appareil</h2>
          <p className="mt-1">
            L’application conserve sur votre appareil votre session de connexion et votre préférence d’affichage. Les
            ressources téléchargées et les réponses enregistrées hors connexion y seront aussi conservées (modules à venir).
          </p>
        </section>
      </div>
    </div>
  );
}
