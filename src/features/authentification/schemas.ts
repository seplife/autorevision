import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Saisissez une adresse e-mail valide.'));

const motDePasse = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(72, 'Le mot de passe ne doit pas dépasser 72 caractères.')
  .regex(/[A-Za-zÀ-ÿ]/, 'Le mot de passe doit contenir au moins une lettre.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.');

export const connexionSchema = z.object({
  email,
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
});
export type ConnexionValues = z.infer<typeof connexionSchema>;

const passwordPair = z.object({ password: z.string(), passwordConfirm: z.string() });

export const inscriptionSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Le nom doit contenir au moins 2 caractères.')
      .max(80, 'Le nom ne doit pas dépasser 80 caractères.'),
    accountType: z.enum(['eleve', 'parent', 'enseignant', 'responsable_pedagogique'], {
      message: 'Choisissez le type de compte.',
    }),
    email,
    password: motDePasse,
    passwordConfirm: z.string(),
    acceptePolitique: z.literal(true, { message: 'Vous devez accepter la politique de confidentialité.' }),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Les deux mots de passe ne correspondent pas.',
    // Vérifier la confirmation même si d'autres champs sont encore invalides.
    when: (payload) => passwordPair.safeParse(payload.value).success,
  });
export type InscriptionValues = z.infer<typeof inscriptionSchema>;

export const motDePasseOublieSchema = z.object({ email });
export type MotDePasseOublieValues = z.infer<typeof motDePasseOublieSchema>;

export const nouveauMotDePasseSchema = z
  .object({ password: motDePasse, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });
export type NouveauMotDePasseValues = z.infer<typeof nouveauMotDePasseSchema>;

/** Code de liaison : 8 caractères de l'alphabet utilisé par le serveur, tirets/espaces tolérés. */
export const LINK_CODE_ALPHABET = /^[A-HJ-NP-Z2-9]{8}$/;

export function normalizeLinkCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export const codeLiaisonSchema = z.object({
  code: z
    .string()
    .transform(normalizeLinkCode)
    .refine((v) => LINK_CODE_ALPHABET.test(v), 'Le code comporte 8 caractères, par exemple ABCD-2345.'),
});
export type CodeLiaisonValues = z.input<typeof codeLiaisonSchema>;
