import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { TextField } from '@/components/Field';
import { connexionSchema, type ConnexionValues } from '@/features/authentification/schemas';
import { messageErreur } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export default function Connexion() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConnexionValues>({ resolver: zodResolver(connexionSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword(values);
      if (authError) throw authError;
      navigate(from && from !== '/connexion' ? from : '/espace', { replace: true });
    } catch (e) {
      setError(messageErreur(e));
    }
  });

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <PageHeader title="Connexion" />
      <Card>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <TextField label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" {...register('email')} error={errors.email?.message} />
          <TextField label="Mot de passe" type="password" autoComplete="current-password" {...register('password')} error={errors.password?.message} />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Se connecter
          </Button>
        </form>
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <Link to="/mot-de-passe-oublie" className="font-medium text-marine-700 underline dark:text-ciel-300">
            Mot de passe oublié ?
          </Link>
          <p>
            Pas encore de compte ?{' '}
            <Link to="/inscription" className="font-medium text-marine-700 underline dark:text-ciel-300">
              Créer un compte
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
