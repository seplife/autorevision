# Réussite Scolaire CI

*Apprendre, s’entraîner, réussir.*

Application de révision scolaire pour l’enseignement secondaire général ivoirien
(3e / BEPC, Terminale A et Terminale D / BAC), conçue pour fonctionner sur smartphone et
ordinateur, y compris hors connexion. Élèves, parents, enseignants, responsables
pédagogiques et administrateurs disposent chacun d’un espace.

> **État : module 1 sur 12 terminé** (fondations, authentification, rôles, liaison
> parent-enfant, référentiel de base). Les cours, exercices, évaluations, le
> téléchargement hors ligne et la synchronisation ne sont **pas encore** développés.
> Voir [`docs/ETAT_DU_PROJET.md`](docs/ETAT_DU_PROJET.md) pour l’état exact.

## Technologies

React 19 · TypeScript strict · Vite 8 · React Router 7 · Tailwind CSS 4 · TanStack Query ·
React Hook Form + Zod · vite-plugin-pwa (Workbox) · Supabase (Auth, PostgreSQL, RLS) ·
Vitest · Testing Library · Playwright.

## Démarrage rapide

```bash
npm install
cp .env.example .env.local      # puis renseignez l’URL et la clé anon de votre projet Supabase
npm run dev                     # http://localhost:5173
```

Sans `.env.local` valide, l’application affiche un écran « Configuration requise » : aucun
backend n’est simulé.

La base de données se prépare en appliquant les migrations de `supabase/migrations/`
sur votre projet Supabase : voir [`docs/GUIDE_SUPABASE.md`](docs/GUIDE_SUPABASE.md).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Vérification des types puis build de production (avec Service Worker) |
| `npm run preview` | Sert le build de production localement |
| `npm run typecheck` | Vérification TypeScript seule |
| `npm test` | Tests unitaires et de composants (jsdom) |
| `npm run test:integration` | Tests SQL/RLS sur un vrai PostgreSQL 16 local (voir ci-dessous) |
| `npm run test:e2e` | Tests de bout en bout Playwright (ordinateur + téléphone) |
| `npm run db:local` | Démarre un PostgreSQL local jetable avec toutes les migrations |

### Tests d’intégration de la base

`npm run test:integration` démarre un PostgreSQL 16 dans `.local/`, crée une base vierge,
applique une **émulation minimale de Supabase Auth** (`supabase/tests/shim/`) puis toutes
les migrations, et vérifie les règles de sécurité en se connectant avec les rôles
`anon` et `authenticated`, exactement comme le fait l’API Supabase. Il faut les binaires
serveur PostgreSQL 16 (`pg_ctl`, `initdb`) et `psql` dans le système (Linux / WSL / macOS).
Sous Windows natif, utilisez WSL ou la CLI Supabase (voir le guide Windows).

## Documentation

- [Architecture et plan](docs/ARCHITECTURE.md)
- [Cahier des charges fonctionnel](docs/CAHIER_DES_CHARGES.md)
- [État réel du projet et résultats des tests](docs/ETAT_DU_PROJET.md)
- [Installation sous Windows](docs/GUIDE_WINDOWS.md)
- [Configuration de Supabase](docs/GUIDE_SUPABASE.md)
- [Déploiement](docs/GUIDE_DEPLOIEMENT.md)
- [Création et validation des contenus](docs/GUIDE_CONTENUS.md)
- [Limites connues](docs/LIMITES.md)

## Principes

- Les permissions sont décidées **par la base** (RLS et fonctions sécurisées), jamais par
  le navigateur.
- Seule la clé publique `anon` est utilisée côté navigateur.
- Aucun programme, sujet ou contenu n’est présenté comme officiel sans validation
  pédagogique documentée.
