import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { SelectField } from '@/components/Field';
import { LoadingScreen } from '@/components/Loading';
import { useAuth } from '@/features/authentification/AuthProvider';
import { messageErreur } from '@/lib/errors';
import { updateStudentClass } from '@/repositories/account';
import { fetchCurrentSchoolYear, fetchGradeLevels } from '@/repositories/referentiel';

export default function ChoixClasse() {
  const navigate = useNavigate();
  const { session, account, refreshAccount } = useAuth();
  const grades = useQuery({ queryKey: ['grade-levels'], queryFn: fetchGradeLevels, staleTime: 60 * 60_000 });
  const year = useQuery({ queryKey: ['school-year-current'], queryFn: fetchCurrentSchoolYear, staleTime: 60 * 60_000 });

  const [gradeId, setGradeId] = useState('');
  const [seriesId, setSeriesId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setGradeId(account?.student?.grade_level_id ?? '');
    setSeriesId(account?.student?.series_id ?? '');
  }, [account?.student?.grade_level_id, account?.student?.series_id]);

  const grade = grades.data?.find((g) => g.id === gradeId);
  const needsSeries = (grade?.academic_series.length ?? 0) > 0;

  const save = useMutation({
    mutationFn: () =>
      updateStudentClass(session!.user.id, {
        grade_level_id: gradeId,
        series_id: needsSeries ? seriesId : null,
        school_year_id: year.data?.id ?? null,
      }),
    onSuccess: async () => {
      await refreshAccount();
      navigate('/eleve', { replace: true });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!gradeId) return setFormError('Choisis ta classe.');
    if (needsSeries && !seriesId) return setFormError('Choisis ta série.');
    save.mutate();
  };

  if (grades.isLoading) return <LoadingScreen label="Chargement des classes…" />;
  if (grades.error) return <Alert tone="error">{messageErreur(grades.error)}</Alert>;

  return (
    <div className="max-w-xl">
      <PageHeader title="Ma classe" description="Ta classe et ta série déterminent les matières et le parcours d’examen proposés." />
      <Card>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {(formError || save.error) && <Alert tone="error">{formError ?? messageErreur(save.error)}</Alert>}
          <SelectField
            label="Classe"
            value={gradeId}
            onChange={(e) => {
              setGradeId(e.target.value);
              setSeriesId('');
            }}
          >
            <option value="">— Choisir —</option>
            {grades.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
                {g.exam_name ? ` (préparation au ${g.exam_name})` : ''}
              </option>
            ))}
          </SelectField>
          {needsSeries && (
            <SelectField label="Série" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
              <option value="">— Choisir —</option>
              {grade?.academic_series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </SelectField>
          )}
          {year.data && <p className="text-sm text-slate-600 dark:text-slate-300">Année scolaire : {year.data.label}</p>}
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
        </form>
      </Card>
    </div>
  );
}
