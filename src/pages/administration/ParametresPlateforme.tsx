import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { TextField } from '@/components/Field';
import { LoadingScreen } from '@/components/Loading';
import { messageErreur } from '@/lib/errors';
import { fetchPlatformSettings, updatePlatformSettings } from '@/repositories/administration';

const schema = z.object({
  platform_name: z.string().trim().min(2, 'Au moins 2 caractères.').max(60, '60 caractères au maximum.'),
  slogan: z.string().trim().max(120, '120 caractères au maximum.'),
  mastery_threshold: z.coerce
    .number({ message: 'Saisissez un nombre.' })
    .min(50, 'Le seuil doit être compris entre 50 et 100.')
    .max(100, 'Le seuil doit être compris entre 50 et 100.'),
});
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export default function ParametresPlateforme() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['platform-settings'], queryFn: fetchPlatformSettings });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values, unknown, Output>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (settings.data) reset(settings.data);
  }, [settings.data, reset]);

  const save = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform-settings'] }),
  });

  if (settings.isLoading) return <LoadingScreen />;
  if (settings.error) return <Alert tone="error">{messageErreur(settings.error)}</Alert>;

  return (
    <div className="max-w-xl">
      <PageHeader title="Paramètres de la plateforme" />
      <Card>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          {save.error && <Alert tone="error">{messageErreur(save.error)}</Alert>}
          {save.isSuccess && <Alert tone="success">Paramètres enregistrés.</Alert>}
          <TextField label="Nom de la plateforme" {...register('platform_name')} error={errors.platform_name?.message} />
          <TextField label="Slogan" {...register('slogan')} error={errors.slogan?.message} />
          <TextField
            label="Seuil de maîtrise d’un chapitre (%)"
            type="number"
            min={50}
            max={100}
            step={1}
            inputMode="numeric"
            hint="Seuil interne à l’application (ce n’est pas une norme officielle)."
            {...register('mastery_threshold')}
            error={errors.mastery_threshold?.message}
          />
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
        </form>
      </Card>
    </div>
  );
}
