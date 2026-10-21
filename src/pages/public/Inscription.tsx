import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { TextField } from '@/components/Field';
import { inscriptionSchema, type InscriptionValues } from '@/features/authentification/schemas';
import { appConfig } from '@/lib/env';
import { messageErreur } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export default function Inscription() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InscriptionValues>({
    resolver: zodResolver(inscriptionSchema),
    defaultValues: { accountType: 'eleve' },
  });
  const accountType = watch('accountType');

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { data, error: authError } = await getSupabase().auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          // « eleve » et « parent » donnent un rôle ; « enseignant » et « responsable_pedagogique » créent
          // seulement une demande à approuver par un administrateur ; toute autre valeur est ignorée.
          data: { display_name: values.displayName, account_type: values.accountType },
          emailRedirectTo: appConfig.configured ? `${appConfig.appUrl}/espace` : undefined,
        },
      });
      if (authError) throw authError;
      if (data.session) {
        navigate(
          values.accountType === 'eleve' ? '/eleve/classe' : values.accountType === 'parent' ? '/parent' : '/compte-en-attente',
          { replace: true },
        );
      } else {
        setEmailSentTo(values.email);
      }
    } catch (e) {
      setError(messageErreur(e));
    }
  });

  if (emailSentTo) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <PageHeader title="Vérifiez votre boîte e-mail" />
        <Alert tone="success" title="Compte créé">
          Un lien de confirmation a été envoyé à <strong>{emailSentTo}</strong>. Ouvrez-le pour activer votre compte, puis
          connectez-vous. Pensez à regarder dans les courriers indésirables.
        </Alert>
        <Link to="/connexion" className="mt-4 inline-block font-medium text-marine-700 underline dark:text-ciel-300">
          Aller à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <PageHeader title="Créer un compte" />
      <Card>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <fieldset>
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">Je suis</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ['eleve', 'Élève'],
                  ['parent', 'Parent ou tuteur'],
                  ['enseignant', 'Enseignant'],
                  ['responsable_pedagogique', 'Responsable pédagogique'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${
                    accountType === value
                      ? 'border-marine-700 bg-marine-50 dark:border-ciel-400 dark:bg-marine-800'
                      : 'border-slate-300 dark:border-marine-600'
                  }`}
                >
                  <input type="radio" value={value} {...register('accountType')} className="size-4" />
                  {label}
                </label>
              ))}
            </div>
            {errors.accountType && <p className="mt-1 text-sm text-red-700">{errors.accountType.message}</p>}
          </fieldset>
          <TextField label={accountType === 'eleve' ? 'Ton prénom et ton nom' : 'Votre prénom et votre nom'} autoComplete="name" {...register('displayName')} error={errors.displayName?.message} />
          <TextField label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" {...register('email')} error={errors.email?.message} />
          <TextField
            label="Mot de passe"
            type="password"
            autoComplete="new-password"
            hint="Au moins 8 caractères, avec au moins une lettre et un chiffre."
            {...register('password')}
            error={errors.password?.message}
          />
          <TextField label="Confirmer le mot de passe" type="password" autoComplete="new-password" {...register('passwordConfirm')} error={errors.passwordConfirm?.message} />
          {accountType === 'eleve' && (
            <Alert tone="info">
              Si tu as moins de 18 ans, crée ton compte avec l’accord de ton parent ou tuteur. Tu pourras ensuite lier son
              compte au tien avec un code.
            </Alert>
          )}
          {(accountType === 'enseignant' || accountType === 'responsable_pedagogique') && (
            <Alert tone="warning" title="Validation par un administrateur">
              Votre compte sera créé, mais le rôle demandé ne vous sera accordé qu’après approbation par un administrateur.
              Utilisez votre adresse e-mail professionnelle.
            </Alert>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 size-4" {...register('acceptePolitique')} />
            <span>
              J’ai lu la{' '}
              <Link to="/confidentialite" className="font-medium underline" target="_blank">
                politique de confidentialité
              </Link>
              .
            </span>
          </label>
          {errors.acceptePolitique && <p className="text-sm text-red-700 dark:text-red-300">{errors.acceptePolitique.message}</p>}
          <Button type="submit" loading={isSubmitting} className="w-full">
            Créer mon compte
          </Button>
        </form>
        <p className="mt-4 text-sm">
          Déjà inscrit ?{' '}
          <Link to="/connexion" className="font-medium text-marine-700 underline dark:text-ciel-300">
            Se connecter
          </Link>
        </p>
      </Card>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Les rôles d’enseignant et de responsable pédagogique sont soumis à l’approbation d’un administrateur. Le rôle
        d’administrateur est uniquement attribué par un autre administrateur.
      </p>
    </div>
  );
}
