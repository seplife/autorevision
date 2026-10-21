import { useQuery } from '@tanstack/react-query';
import { Alert } from '@/components/Alert';
import { Card, PageHeader } from '@/components/Card';
import { useAuth } from '@/features/authentification/AuthProvider';
import { messageErreur } from '@/lib/errors';
import { fetchGradeLevels } from '@/repositories/referentiel';
import { getSupabase } from '@/lib/supabase';
import { ROLE_LABELS } from '@/types/domain';

async function fetchCoverageSummary(): Promise<{ subjects: number; curricula: number; valides: number; chapitres: number }> {
  const sb = getSupabase();
  const head = { count: 'exact' as const, head: true };
  const [s, c, v, ch] = await Promise.all([
    sb.from('subjects').select('id', head),
    sb.from('curricula').select('id', head),
    sb.from('curricula').select('id', head).eq('verification_status', 'valide'),
    sb.from('chapters').select('id', head),
  ]);
  for (const r of [s, c, v, ch]) if (r.error) throw r.error;
  return { subjects: s.count ?? 0, curricula: c.count ?? 0, valides: v.count ?? 0, chapitres: ch.count ?? 0 };
}

/** Espace enseignant / responsable : état réel du référentiel (les outils d'édition arrivent aux modules 2 et 3). */
export default function EspacePedagogique() {
  const { roles } = useAuth();
  const grades = useQuery({ queryKey: ['grade-levels'], queryFn: fetchGradeLevels });
  const coverage = useQuery({ queryKey: ['coverage-summary'], queryFn: fetchCoverageSummary });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Espace pédagogique"
        description={`Rôle : ${roles.filter((r) => r === 'enseignant' || r === 'responsable_pedagogique').map((r) => ROLE_LABELS[r]).join(', ')}`}
      />
      <Card title="État du référentiel (données réelles)">
        {coverage.error ? (
          <Alert tone="error">{messageErreur(coverage.error)}</Alert>
        ) : (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Matières', coverage.data?.subjects],
              ['Programmes', coverage.data?.curricula],
              ['Programmes validés', coverage.data?.valides],
              ['Chapitres', coverage.data?.chapitres],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-slate-50 p-3 dark:bg-marine-800">
                <dt className="text-sm text-slate-600 dark:text-slate-300">{label}</dt>
                <dd className="text-2xl font-bold">{value ?? '…'}</dd>
              </div>
            ))}
          </dl>
        )}
        {coverage.data && coverage.data.curricula === 0 && (
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Aucun programme n’a encore été saisi. Les programmes doivent être établis à partir des référentiels officiels
            ivoiriens et marqués « À vérifier » jusqu’à leur validation.
          </p>
        )}
      </Card>
      <Card title="Classes configurées">
        <ul className="list-disc pl-5">
          {grades.data?.map((g) => (
            <li key={g.id}>
              {g.label}
              {g.exam_name ? ` — ${g.exam_name}` : ''}
              {g.academic_series.length > 0 && ` (séries : ${g.academic_series.map((s) => s.code).join(', ')})`}
            </li>
          ))}
        </ul>
      </Card>
      <Alert tone="info" title="Prochaines étapes">
        La saisie des programmes, des chapitres et des cours, ainsi que le circuit de validation, font l’objet des modules 2
        et 3.
      </Alert>
    </div>
  );
}
