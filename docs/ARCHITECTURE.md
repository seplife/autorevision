# Réussite Scolaire CI — Architecture et plan de réalisation

> Document de conception (étape B du prompt maître). Il décrit l'état cible et indique
> explicitement ce qui est réalisé dans le module 1. L'état réel du projet est tenu à jour
> dans [`ETAT_DU_PROJET.md`](./ETAT_DU_PROJET.md).

## 0. Audit initial

Environnement examiné le 17/10/2026 : **aucun projet existant** (répertoire de travail vide,
pas de dépôt git). Outils disponibles : Node.js 22, npm 10, PostgreSQL 16 (binaires serveur),
Playwright. Docker est installé mais son démon n'est pas joignable, donc la CLI Supabase
locale (qui repose sur Docker) ne peut pas tourner ici. Les migrations sont donc testées sur
un PostgreSQL 16 local équipé d'une **couche d'émulation minimale de Supabase Auth**
(schéma `auth`, rôles `anon` / `authenticated` / `service_role`, fonction `auth.uid()`).
Aucun projet Supabase distant n'est configuré : aucun identifiant n'a été fourni.

## 1. Architecture proposée

```
┌──────────────────────────── Navigateur / PWA installée ────────────────────────────┐
│  React 19 + TypeScript strict + React Router 7                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐                     │
│  │ pages/*      │→ │ features/*       │→ │ repositories/*     │── en ligne ──┐      │
│  │ (UI, routes) │  │ (logique métier, │  │ (accès données :   │              │      │
│  └──────────────┘  │  hooks, schémas) │  │  Supabase / local) │── local ──┐  │      │
│                    └──────────────────┘  └────────────────────┘           │  │      │
│  Service Worker (Workbox) : coquille applicative + ressources    IndexedDB ◄┘  │      │
│  téléchargées ; page de démarrage hors ligne                     (module 9)    │      │
└────────────────────────────────────────────────────────────────────────────────┼──────┘
                                                                                 │ HTTPS
┌──────────────────────────────────── Supabase ──────────────────────────────────▼──────┐
│ Auth (comptes, sessions)  │  PostgreSQL + RLS  │  Storage (fichiers)  │ Edge Functions │
│                           │  fonctions SECURITY DEFINER pour les opérations sensibles │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

Principes :

- **Le serveur décide des permissions.** Le navigateur n'envoie jamais un rôle ou un
  identifiant qui serait cru sur parole : toutes les règles sont dans les politiques RLS et
  dans des fonctions SQL `SECURITY DEFINER` qui s'appuient sur `auth.uid()`.
- **Les opérations sensibles passent par des fonctions RPC** (attribution de rôle, liaison
  parent-enfant, validation de programme) qui écrivent un journal d'audit.
- **Seule la clé publique (`anon`) est dans le frontend.** La clé `service_role` n'est
  utilisée que dans les Edge Functions ou en ligne de commande.
- **Hors ligne d'abord pour l'élève** : à partir du module 9, la lecture des contenus
  téléchargés et l'enregistrement des réponses ne dépendent d'aucune requête réseau.

## 2. Arborescence

```
reussite-scolaire-ci/
├── docs/                      Conception, guides, état du projet
├── public/                    Icônes, robots.txt (le manifeste est généré par vite-plugin-pwa)
├── scripts/
│   └── db-local.mjs           Démarre un PostgreSQL 16 jetable + applique les migrations
├── supabase/
│   ├── migrations/            Migrations SQL versionnées (ordre lexicographique)
│   └── tests/shim/            Émulation de Supabase Auth pour les tests hors Docker
├── src/
│   ├── app/                   Routeur, fournisseurs globaux
│   ├── components/            Composants d'interface réutilisables
│   ├── layouts/               Gabarits (public, connecté)
│   ├── pages/{public,eleve,parent,enseignant,administration}/
│   ├── features/
│   │   ├── authentification/  Session, rôles, gardes de routes, formulaires
│   │   ├── connectivite/      État réseau + joignabilité réelle du serveur
│   │   ├── parents/           Codes de liaison parent-enfant
│   │   ├── programmes/        Référentiel scolaire
│   │   └── …                  (cours, exercices, évaluations, progression, sync… à venir)
│   ├── repositories/          Accès aux données (Supabase aujourd'hui, IndexedDB ensuite)
│   ├── lib/                   Client Supabase, validation de l'environnement, utilitaires
│   ├── types/                 Types partagés (dont types de la base)
│   └── styles/
└── tests/
    ├── unit/                  Vitest + Testing Library (jsdom)
    ├── integration/           Vitest + PostgreSQL réel : migrations et RLS
    └── e2e/                   Playwright : coquille hors ligne, responsive, clavier (étendu au module 9)
```

## 3. Modèle de données

Le schéma complet est construit migration par migration. Vue d'ensemble des domaines :

| Domaine | Tables | Module |
|---|---|---|
| Identité & sécurité | `profiles`, `user_roles`, `students`, `parents`, `teachers`, `parent_student_links`, `invitations`, `invitation_attempts`, `audit_logs` | **1 (fait)** |
| Référentiel scolaire | `school_years`, `grade_levels`, `academic_series`, `subjects`, `curricula`, `curriculum_references`, `chapters`, `competencies`, `learning_objectives` | **1 (fait)** |
| Paramètres | `platform_settings` (nom de la plateforme, slogan, seuil de maîtrise) | **1 (fait)** |
| Contenus | `lessons`, `lesson_versions`, `lesson_sections`, `resources`, `resource_files`, `content_sources`, `content_reviews`, `content_publications`, `content_tags` | 4 |
| Exercices & évaluations | `exercises`, `questions`, `question_options`, `answer_keys`, `grading_rubrics`, `assessments`, `assessment_questions`, `assessment_attempts`, `student_answers`, `assessment_results` | 5 |
| Progression | `learning_events`, `student_progress`, `revision_plans`, `revision_sessions`, `bookmarks`, `personal_notes`, `remediation_recommendations` | 6 |
| Suivi parental | `parental_goals`, `notification_preferences`, `notifications`, `weekly_reports` | 7 |
| Synchronisation | `device_installations`, `sync_receipts`, `content_versions`, `synchronization_logs` | 10 |

Conventions : clés primaires UUID (`gen_random_uuid()`), `created_at` / `updated_at`
maintenus par déclencheur, clés étrangères explicites avec règle de suppression choisie
(`cascade` pour les données qui n'ont pas de sens sans leur parent, `restrict` pour le
référentiel), index sur toutes les clés étrangères utilisées en filtre, RLS activée sur
**toutes** les tables du schéma `public`.

Statut de vérification du référentiel (`verification_status`) : `a_verifier` →
`en_verification` → `valide`. Un programme ne peut être `valide` que si l'organisme
émetteur, la référence documentaire, le validateur et la date de validation sont renseignés
(contrainte `CHECK` en base, pas seulement dans l'interface).

## 4. Rôles et permissions

| Rôle | Attribution | Peut |
|---|---|---|
| `eleve` | à l'inscription (auto-déclaré) | lire le référentiel, choisir sa classe/série, générer un code de liaison parent, voir ses parents liés, révoquer un lien |
| `parent` | à l'inscription (auto-déclaré) | utiliser un code de liaison, voir **uniquement** les enfants liés et actifs, révoquer un lien |
| `enseignant` | par un administrateur | (module 4) rédiger et soumettre des contenus dans ses matières |
| `responsable_pedagogique` | par un administrateur | gérer le référentiel, valider les programmes et les contenus |
| `administrateur` | par un autre administrateur (le premier : en ligne de commande) | gérer les rôles, les paramètres, lire le journal d'audit |

Règles garanties en base :

- Seuls `eleve` et `parent` peuvent être choisis à l'inscription ; toute autre valeur des
  métadonnées est ignorée.
- `user_roles` n'est modifiable par aucun client directement (pas de politique
  `insert/update/delete`). Seules `admin_grant_role` / `admin_revoke_role` le modifient,
  après contrôle `is_admin()`, **interdiction de se modifier soi-même**, et écriture d'audit.
- Liaison parent-enfant : l'élève génère un code à usage unique valable 48 h (seul
  le hachage SHA-256 est stocké) ; le parent le saisit ; après 5 échecs en 1 h, le compte
  parent est temporairement bloqué. Connaître le nom, la classe ou le téléphone d'un
  enfant ne donne accès à rien.
- Un parent ne voit un élève que via `is_parent_of(student_id)` qui exige un lien `actif`.

## 5. Fonctionnement hors ligne (cible, modules 9–10)

- **Service Worker (Workbox via vite-plugin-pwa)** : précache de la coquille applicative,
  repli de navigation sur `index.html`, cache des fichiers de ressources téléchargés.
  *Module 1 : coquille et manifeste en place.*
- **IndexedDB** (bibliothèque `idb`) : ressources téléchargées, tentatives, réponses,
  progression, notes, file de synchronisation. Schéma versionné avec migrations qui ne
  suppriment jamais une file non vide.
- **File de synchronisation** : chaque opération porte un UUID généré sur l'appareil,
  utilisateur, appareil, horodatage, type, référence d'objet, version de schéma, statut,
  nombre d'essais. Le serveur l'enregistre via une fonction idempotente
  (`insert … on conflict (operation_id) do nothing`) et renvoie un accusé de réception ;
  seul l'accusé fait passer l'opération à « synchronisée ».
- **Reconnexion** : l'événement `online` déclenche seulement une *vérification* de
  joignabilité (requête de santé avec délai maximal) — *module 1 : déjà implémenté dans
  `features/connectivite`* — puis vérification de session, envoi ordonné, recul
  exponentiel en cas d'erreur.
- **Conflits** : tentatives et résultats ne se fusionnent pas (chaque tentative est
  distincte) ; progression = journal d'événements ; notes personnelles = numéro de version
  avec détection de conflit ; contenus = la version validée du serveur fait foi ;
  permissions = toujours vérifiées côté serveur.

## 6. Plan de réalisation

| # | Module | Contenu | État |
|---|---|---|---|
| 1 | Fondations + authentification et rôles | Projet, PWA coquille, connectivité, Supabase Auth, rôles, liaison parent-enfant, référentiel de base, admin des rôles, tests RLS | **réalisé (voir état)** |
| 2 | Référentiel complet | Écrans de gestion des matières/programmes/chapitres, workflow de vérification, couverture | à faire |
| 3 | Gestion des cours | Contenus versionnés, workflow éditorial, sources, Storage | à faire |
| 4 | Moteur d'exercices et d'évaluations | Types de questions, correction déterministe, chronomètre, reprise | à faire |
| 5 | Progression | Événements, indicateurs, remédiation | à faire |
| 6 | Espace parent | Tableau de bord, indicateurs expliqués, alertes | à faire |
| 7 | Administration pédagogique | Affectations, validation, statistiques | à faire |
| 8 | Téléchargements hors ligne | IndexedDB, packs, tailles estimées | à faire |
| 9 | Synchronisation | File, idempotence, reprise, conflits, tests Playwright mode avion | à faire |
| 10 | Planning de révision | Planificateur, révision espacée | à faire |
| 11 | Rapports | Élève, parent, pédagogique | à faire |
| 12 | Optimisation, sécurité, accessibilité | Audit Lighthouse/axe, durcissement | à faire |

Écart justifié par rapport à l'ordre du prompt : la *vérification de joignabilité*
(prérequis de la synchronisation) est faite dès le module 1 car l'indicateur de connexion
fait partie de la coquille applicative.

## 7. Dépendances

| Paquet | Rôle | Justification |
|---|---|---|
| `react`, `react-dom`, `react-router-dom` | Interface et routes | demandé |
| `@supabase/supabase-js` | Auth, base, Storage | backend demandé |
| `@tanstack/react-query` | Cache des requêtes distantes | demandé ; évite de réécrire le cache |
| `react-hook-form`, `zod`, `@hookform/resolvers` | Formulaires et validation | demandé |
| `idb` | Accès IndexedDB typé | ~1 ko, promesses au lieu de l'API événementielle (module 8) |
| `vite`, `@vitejs/plugin-react`, `typescript` | Build | demandé |
| `vite-plugin-pwa` | Manifeste + Service Worker Workbox | évite un Service Worker maison fragile |
| `tailwindcss`, `@tailwindcss/vite` | Styles | demandé |
| `vitest`, `@testing-library/*`, `jsdom` | Tests unitaires et composants | |
| `pg` (dev) | Tests d'intégration SQL/RLS | |
| `@playwright/test` (dev) | Tests de bout en bout, mode avion | |

Aucune bibliothèque de composants lourde : les composants accessibles nécessaires
(boutons, champs, alertes) sont écrits sur place avec Tailwind, ce qui limite le poids sur
les téléphones d'entrée de gamme.
