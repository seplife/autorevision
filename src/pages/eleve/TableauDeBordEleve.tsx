import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/Alert';
import { Card, PageHeader } from '@/components/Card';
import { useAuth } from '@/features/authentification/AuthProvider';
import { classLabel, fetchGradeLevels } from '@/repositories/referentiel';
import { listFamilyLinks } from '@/repositories/family';

export default function TableauDeBordEleve() {
  const { account } = useAuth();
  const grades = useQuery({ queryKey: ['grade-levels'], queryFn: fetchGradeLevels, staleTime: 60 * 60_000 });
  const links = useQuery({ queryKey: ['family-links'], queryFn: listFamilyLinks });
  const student = account?.student;
  const label = grades.data ? classLabel(grades.data, student?.grade_level_id ?? null, student?.series_id ?? null) : null;

  return (
    <div>
      <PageHeader title={`Bonjour ${account?.profile?.display_name ?? ''}`} description="Ton espace de révision." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Ma classe">
          {student?.grade_level_id ? (
            <p className="text-lg font-semibold">{label ?? '…'}</p>
          ) : (
            <Alert tone="warning">Tu n’as pas encore choisi ta classe.</Alert>
          )}
          <Link to="/eleve/classe" className="mt-3 inline-block font-medium text-marine-700 underline dark:text-ciel-300">
            {student?.grade_level_id ? 'Modifier ma classe' : 'Choisir ma classe'}
          </Link>
        </Card>
        <Card title="Mes parents">
          {links.isLoading ? (
            <p>Chargement…</p>
          ) : (links.data?.length ?? 0) === 0 ? (
            <p>Aucun parent n’est encore lié à ton compte.</p>
          ) : (
            <ul className="list-disc pl-5">
              {links.data?.map((l) => (
                <li key={l.link_id}>{l.other_display_name}</li>
              ))}
            </ul>
          )}
          <Link to="/eleve/parents" className="mt-3 inline-block font-medium text-marine-700 underline dark:text-ciel-300">
            Gérer les liens avec mes parents
          </Link>
        </Card>
        <Card title="Mes révisions" className="lg:col-span-2">
          <p className="text-slate-700 dark:text-slate-300">
            Les cours sont publiés après avoir été préparés et vérifiés par l’équipe pédagogique. Les exercices et
            évaluations viendront ensuite.
          </p>
          <Link to="/eleve/cours" className="mt-3 inline-block font-medium text-marine-700 underline dark:text-ciel-300">
            Voir mes cours
          </Link>
        </Card>
      </div>
    </div>
  );
}
