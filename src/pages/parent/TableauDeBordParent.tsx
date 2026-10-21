import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { TextField } from '@/components/Field';
import { codeLiaisonSchema, type CodeLiaisonValues } from '@/features/authentification/schemas';
import { messageErreur } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { listFamilyLinks, redeemParentLinkCode, REDEEM_MESSAGES } from '@/repositories/family';
import { classLabel, fetchGradeLevels } from '@/repositories/referentiel';
import { LinkedPeopleList } from '@/pages/eleve/LiaisonParents';
import type { StudentRecord } from '@/types/domain';

async function fetchChildrenRecords(ids: string[]): Promise<StudentRecord[]> {
  if (ids.length === 0) return [];
  // La RLS ne renvoie que les élèves liés activement à ce parent.
  const { data, error } = await getSupabase()
    .from('students')
    .select('user_id, grade_level_id, series_id, school_year_id')
    .in('user_id', ids);
  if (error) throw error;
  return (data ?? []) as StudentRecord[];
}

export default function TableauDeBordParent() {
  const queryClient = useQueryClient();
  const links = useQuery({ queryKey: ['family-links'], queryFn: listFamilyLinks });
  const children = (links.data ?? []).filter((l) => l.relation === 'enfant');
  const childIds = children.map((c) => c.other_user_id);
  const records = useQuery({
    queryKey: ['children-records', childIds],
    queryFn: () => fetchChildrenRecords(childIds),
    enabled: links.isSuccess,
  });
  const grades = useQuery({ queryKey: ['grade-levels'], queryFn: fetchGradeLevels, staleTime: 60 * 60_000 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CodeLiaisonValues>({ resolver: zodResolver(codeLiaisonSchema) });

  const redeem = useMutation({
    mutationFn: (code: string) => redeemParentLinkCode(code),
    onSuccess: (status) => {
      if (status === 'lie' || status === 'deja_lie') {
        reset();
        void queryClient.invalidateQueries({ queryKey: ['family-links'] });
      }
    },
  });

  const onSubmit = handleSubmit((values) => redeem.mutate(String(values.code)));
  const resultTone = redeem.data === 'lie' || redeem.data === 'deja_lie' ? 'success' : 'error';

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Mes enfants" description="Suivez le travail de vos enfants liés à votre compte." />

      <Card title="Enfants suivis">
        {links.isLoading ? (
          <p>Chargement…</p>
        ) : links.error ? (
          <Alert tone="error">{messageErreur(links.error)}</Alert>
        ) : children.length === 0 ? (
          <p className="text-slate-700 dark:text-slate-300">Aucun enfant n’est encore lié à votre compte.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {children.map((c) => {
              const rec = records.data?.find((r) => r.user_id === c.other_user_id);
              const label = grades.data && rec ? classLabel(grades.data, rec.grade_level_id, rec.series_id) : null;
              return (
                <li key={c.link_id} className="rounded-lg border border-slate-200 p-4 dark:border-marine-700">
                  <p className="text-lg font-semibold">{c.other_display_name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{label ?? 'Classe non renseignée'}</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    Aucun résultat synchronisé pour l’instant : le suivi des exercices et des scores sera disponible avec les
                    prochains modules.
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Lier un enfant">
        <p className="mb-3 text-slate-700 dark:text-slate-300">
          Demandez à votre enfant de générer un code dans son espace (« Mes parents »), puis saisissez-le ici.
        </p>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="sm:w-64">
            <TextField
              label="Code de liaison"
              placeholder="ABCD-2345"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              {...register('code')}
              error={errors.code?.message}
            />
          </div>
          <Button type="submit" loading={redeem.isPending} className="sm:mt-7">
            Lier
          </Button>
        </form>
        <div className="mt-3">
          {redeem.error && <Alert tone="error">{messageErreur(redeem.error)}</Alert>}
          {redeem.data && <Alert tone={resultTone}>{REDEEM_MESSAGES[redeem.data]}</Alert>}
        </div>
      </Card>

      <Card title="Gérer les liens">
        <LinkedPeopleList relationLabel="compte" />
      </Card>
    </div>
  );
}
