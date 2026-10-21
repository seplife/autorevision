# Configuration de Supabase

## 1. Créer le projet

1. Créez un projet sur <https://supabase.com> (région la plus proche de vos utilisateurs).
2. Notez dans *Project Settings → API* : l’**URL du projet** et la **clé `anon` publique**.
   La clé `service_role` ne doit **jamais** être copiée dans `.env.local` ni dans le code
   de l’application.

## 2. Appliquer les migrations

Les migrations sont dans `supabase/migrations/`, à appliquer **dans l’ordre des noms de
fichiers** :

| Fichier | Contenu |
|---|---|
| `20261017000100_fondations.sql` | extension pgcrypto, types énumérés, fonction `set_updated_at` |
| `20261017000200_identite_roles.sql` | profils, rôles, élèves, parents, enseignants, liaison parent-enfant, audit, RLS |
| `20261017000300_referentiel.sql` | années, classes, séries, matières, programmes, chapitres, compétences, objectifs, RLS |
| `20261017000400_parametres_donnees_reference.sql` | paramètres de la plateforme ; classes 3e et Terminale, séries A et D ; année 2026-2027 |

**Option A — CLI Supabase (recommandée)**

```bash
npx supabase login
npx supabase link --project-ref <référence-du-projet>
npx supabase db push
```

**Option B — Éditeur SQL du tableau de bord** : ouvrez *SQL Editor*, collez et exécutez
chaque fichier, un par un, dans l’ordre. N’exécutez **pas** le fichier
`supabase/tests/shim/…` : il sert uniquement aux tests hors Supabase.

Les migrations ne sont pas idempotentes : ne les rejouez pas sur une base où elles ont
déjà été appliquées (la CLI gère cet historique pour vous).

## 3. Réglages d’authentification

Dans *Authentication* :

- **URL Configuration** : *Site URL* = URL publique de l’application ; ajoutez aux
  *Redirect URLs* : `https://votre-domaine/espace` et `https://votre-domaine/nouveau-mot-de-passe`
  (et les équivalents `http://localhost:5173/...` pour le développement).
- **Email** : laissez la confirmation d’adresse activée en production.
- **SMTP** : le service d’e-mail intégré de Supabase est limité à quelques messages par
  heure ; configurez un SMTP dédié avant tout pilote.
- **Mots de passe** : longueur minimale 8 (cohérent avec le formulaire).

## 4. Créer le premier administrateur

Aucun utilisateur ne peut se donner un rôle lui-même. Le premier administrateur est donc
désigné une seule fois depuis l’éditeur SQL (qui s’exécute avec les droits du
propriétaire) :

1. Inscrivez-vous normalement dans l’application (type « Parent » par exemple).
2. Dans *SQL Editor* :

```sql
insert into public.user_roles (user_id, role)
select id, 'administrateur' from auth.users where email = 'admin@exemple.ci';

insert into public.audit_logs (actor_id, action, target_table, target_id, details)
select null, 'role.attribue.amorcage', 'user_roles', id::text, '{"role":"administrateur"}'
from auth.users where email = 'admin@exemple.ci';
```

Ensuite, tous les autres rôles (enseignant, responsable pédagogique, autres
administrateurs) s’attribuent depuis l’écran *Utilisateurs et rôles* de l’application.

## 5. Configurer l’application

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=<clé anon>
# VITE_APP_URL=http://localhost:5173
```

## 6. Vérifier

- Inscription élève → l’écran « Ma classe » propose Troisième et Terminale (séries A, D).
- *Table Editor* → `user_roles` contient le rôle `eleve` du nouveau compte.
- *Database → Advisors (Security)* ne doit signaler aucune table sans RLS.
