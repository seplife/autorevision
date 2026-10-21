# Déploiement

L’application est un site statique (dossier `dist/`) relié à Supabase. N’importe quel
hébergeur de fichiers statiques **en HTTPS** convient (Netlify, Vercel, Cloudflare Pages,
serveur Nginx…). HTTPS est obligatoire pour le Service Worker et l’installation PWA.

## Étapes

1. Appliquez les migrations sur le projet Supabase de production (voir `GUIDE_SUPABASE.md`).
2. Définissez chez l’hébergeur les variables de build :
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL` (URL publique).
3. Commande de build : `npm ci && npm run build` ; dossier publié : `dist`.
4. **Réécriture des routes** : toute URL inconnue doit renvoyer `index.html`
   (application monopage).
   - Netlify : fichier `public/_redirects` contenant `/*  /index.html  200`.
   - Nginx : `try_files $uri /index.html;`
5. **En-têtes de cache** : `sw.js` et `index.html` ne doivent pas être mis en cache
   longtemps (`Cache-Control: no-cache`) ; les fichiers de `assets/` (noms avec empreinte)
   peuvent l’être (`max-age=31536000, immutable`).
6. Dans Supabase, mettez à jour *Site URL* et *Redirect URLs* avec le domaine définitif.

## Mises à jour de l’application

Le Service Worker est en mode « prompt » : quand une nouvelle version est publiée,
l’utilisateur voit « Une nouvelle version est disponible » et choisit le moment de la
mise à jour (jamais au milieu d’une évaluation). Les données locales ne sont pas effacées
par une mise à jour.

## Migrations de base en production

- Ajoutez toujours une **nouvelle** migration ; ne modifiez jamais une migration déjà
  appliquée.
- Testez-la d’abord : `npm run test:integration` (base vierge + toutes les migrations).
- Sauvegardez la base avant `supabase db push` en production.

## Avant un lancement public

Validation pédagogique réelle des ressources, audit de sécurité, relecture juridique
(données personnelles de mineurs, consentement parental, conservation), SMTP dédié et
phase pilote. Voir `LIMITES.md`.
