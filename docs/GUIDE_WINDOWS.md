# Installation sous Windows

## Prérequis

1. **Node.js 20 ou plus récent** (version LTS) : <https://nodejs.org>. Vérifiez dans
   PowerShell : `node -v` et `npm -v`.
2. **Git** : <https://git-scm.com/download/win>.
3. Un éditeur, par exemple Visual Studio Code.

## Lancer l’application

```powershell
git clone <adresse-du-dépôt> reussite-scolaire-ci
cd reussite-scolaire-ci
npm install
Copy-Item .env.example .env.local
notepad .env.local      # renseignez l'URL et la clé anon Supabase
npm run dev
```

Ouvrez <http://localhost:5173>.

Pour tester sur un téléphone du même réseau Wi-Fi : `npm run dev -- --host`, puis ouvrez
l’adresse « Network » affichée. L’installation PWA et le Service Worker exigent HTTPS
(sauf sur `localhost`) : pour tester l’installation sur téléphone, utilisez un déploiement
de prévisualisation (voir le guide de déploiement).

## Tests

- `npm test` (unitaires) et `npm run typecheck` fonctionnent directement sous Windows.
- `npm run test:e2e` : installez d’abord le navigateur de test avec
  `npx playwright install chromium`.
- `npm run test:integration` nécessite PostgreSQL 16 avec `pg_ctl`/`initdb` et un shell de
  type Unix : utilisez **WSL 2** (Ubuntu : `sudo apt install postgresql-16`), puis lancez
  la commande depuis WSL. Alternative : installer Docker Desktop et utiliser la CLI
  Supabase (`npx supabase start`, `npx supabase db reset`).

## Problèmes fréquents

| Symptôme | Solution |
|---|---|
| Écran « Configuration requise » | `.env.local` absent ou contient encore les valeurs d’exemple ; redémarrez `npm run dev` après modification. |
| « Le serveur est injoignable » à la connexion | URL Supabase erronée, projet en pause, ou pare-feu. |
| Les liens reçus par e-mail ouvrent une mauvaise adresse | Vérifiez *Site URL* et *Redirect URLs* dans Supabase. |
| Scripts bloqués par PowerShell | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
