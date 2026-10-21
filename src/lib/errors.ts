/**
 * Traduction des erreurs techniques en messages compréhensibles, sans divulguer
 * de détail interne (noms de tables, requêtes…).
 */
const KNOWN: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Adresse e-mail ou mot de passe incorrect.'],
  [/email not confirmed/i, 'Votre adresse e-mail n’est pas encore confirmée. Ouvrez le lien reçu par e-mail.'],
  [/user already registered|already been registered/i, 'Un compte existe déjà avec cette adresse e-mail.'],
  [/password should be at least|weak password/i, 'Ce mot de passe est trop faible.'],
  [/rate limit|too many requests|over_email_send_rate_limit/i, 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'],
  [/jwt expired|session.*(expired|missing)|refresh token/i, 'Votre session a expiré. Veuillez vous reconnecter.'],
  [/auto_modification_interdite/, 'Vous ne pouvez pas modifier vos propres rôles. Un autre administrateur doit le faire.'],
  [/acces_refuse|permission denied|row-level security|42501/i, 'Vous n’avez pas l’autorisation d’effectuer cette action.'],
  [/trop_de_codes/, 'Trop de codes générés récemment. Attendez une heure avant d’en créer un nouveau.'],
  [/lien_introuvable/, 'Ce lien n’existe pas ou a déjà été supprimé.'],
  [/utilisateur_introuvable/, 'Ce compte est introuvable.'],
  [/demande_introuvable/, 'Cette demande n’existe plus ou a déjà été traitée.'],
  [/students_series_in_grade_fk/, 'Cette série ne correspond pas à la classe choisie.'],
  [/transition_interdite/, 'Cette action n’est pas possible pour ce cours dans son état actuel, ou vous n’y êtes pas autorisé. Un cours ne peut pas être validé par son auteur.'],
  [/programme_non_valide/, 'Publication impossible : le programme de ce chapitre n’est pas encore « Validé pédagogiquement ».'],
  [/cours_non_modifiable/, 'Ce cours n’est plus modifiable dans son état actuel.'],
  [/cours_publie_non_supprimable/, 'Un cours publié ne peut pas être supprimé directement : archivez-le d’abord.'],
  [/contenu_requis/, 'Le contenu du cours est vide : rédigez-le avant de le soumettre.'],
  [/commentaire_requis/, 'Un commentaire est obligatoire pour demander des corrections.'],
  [/titre_requis/, 'Le titre du cours est obligatoire.'],
  [/cours_introuvable|chapitre_introuvable/, 'Ce cours ou ce chapitre est introuvable.'],
  [/PGRST202|PGRST205|schema cache|42883|42P01/i, 'La base de données n’est pas à jour (table ou fonction SQL manquante dans Supabase). Exécutez la dernière migration dans SQL Editor.'],
  [/failed to fetch|networkerror|load failed|network request failed/i, 'Le serveur est injoignable. Vérifiez votre connexion Internet.'],
];

export function messageErreur(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error ?? '');
  for (const [pattern, message] of KNOWN) {
    if (pattern.test(raw)) return message;
  }
  return 'Une erreur inattendue est survenue. Réessayez dans un instant.';
}
