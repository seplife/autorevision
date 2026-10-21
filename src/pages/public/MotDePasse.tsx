import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { TextField } from '@/components/Field';
import { useAuth } from '@/features/authentification/AuthProvider';
import {
  motDePasseOublieSchema,
  nouveauMotDePasseSchema,
  type MotDePasseOublieValues,
  type NouveauMotDePasseValues,
} from '@/features/authentification/schemas';
import { appConfig } from '@/lib/env';
import { messageErreur } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export function MotDePasseOublie() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MotDePasseOublieValues>({ resolver: zodResolver(motDePasseOublieSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      const { error: authError } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: appConfig.configured ? `${appConfig.appUrl}/nouveau-mot-de-passe` : undefined,
      });
      if (authError) throw authError;
      // Même message que l'adresse existe ou non, pour ne pas révéler quels comptes existent.
      setSent(true);
    } catch (e) {
      setError(messageErreur(e));
    }
  });

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <PageHeader title="Récupérer mon compte" description="Saisissez l’adresse e-mail de votre compte pour recevoir un lien de réinitialisation." />
      <Card>
        {sent ? (
          <Alert tone="success" title="Demande envoyée">
            Si un compte correspond à cette adresse, un e-mail contenant un lien de réinitialisation vient d’être envoyé.
          </Alert>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            <TextField label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" {...register('email')} error={errors.email?.message} />
            <Button type="submit" loading={isSubmitting} className="w-full">
              Envoyer le lien
            </Button>
          </form>
        )}
        <Link to="/connexion" className="mt-4 inline-block text-sm font-medium text-marine-700 underline dark:text-ciel-300">
          Retour à la connexion
        </Link>
      </Card>
    </div>
  );
}

export function NouveauMotDePasse() {
  const navigate = useNavigate();
  const { session, initializing, clearPasswordRecovery } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NouveauMotDePasseValues>({ resolver: zodResolver(nouveauMotDePasseSchema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      const { error: authError } = await getSupabase().auth.updateUser({ password });
      if (authError) throw authError;
      clearPasswordRecovery();
      navigate('/espace', { replace: true });
    } catch (e) {
      setError(messageErreur(e));
    }
  });

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <PageHeader title="Choisir un nouveau mot de passe" />
      <Card>
        {!initializing && !session ? (
          <Alert tone="warning" title="Lien invalide ou expiré">
            Ouvrez cette page depuis le lien reçu par e-mail, ou{' '}
            <Link to="/mot-de-passe-oublie" className="underline">
              demandez un nouveau lien
            </Link>
            .
          </Alert>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            <TextField label="Nouveau mot de passe" type="password" autoComplete="new-password" hint="Au moins 8 caractères, avec au moins une lettre et un chiffre." {...register('password')} error={errors.password?.message} />
            <TextField label="Confirmer le mot de passe" type="password" autoComplete="new-password" {...register('passwordConfirm')} error={errors.passwordConfirm?.message} />
            <Button type="submit" loading={isSubmitting} className="w-full">
              Enregistrer
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
