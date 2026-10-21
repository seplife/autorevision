# Limites connues

## Limites de l'état actuel (module 1)

- **Aucun contenu pédagogique** : pas de cours, exercices, QCM, évaluations ni examens
  blancs. Aucune matière ni chapitre n'est saisi (volontairement : ils doivent provenir
  des référentiels officiels vérifiés).
- **Hors ligne limité à la coquille** : après une première visite en ligne, les écrans
  s'ouvrent sans réseau (vérifié par Playwright). Le téléchargement de ressources,
  IndexedDB, l'enregistrement de réponses hors ligne et la file de synchronisation ne
  sont pas encore développés (modules 8–9).
- **Pas testé contre un vrai projet Supabase** : aucun identifiant n'a été fourni et Docker
  n'était pas disponible. Les migrations et la RLS sont testées sur PostgreSQL 16 avec une
  émulation minimale de Supabase Auth ; les écrans connectés (élève, parent, admin) sont
  vérifiés par le typage, des tests de composants et la logique serveur testée, mais n'ont
  pas été parcourus de bout en bout contre un serveur Supabase réel.
- **Suppression de compte** : pas encore d'écran ; la suppression se fait par
  l'administration (suppression de l'utilisateur dans Supabase Auth, qui supprime en
  cascade profil, rôles, fiches et liens). Une procédure outillée et journalisée reste à
  écrire.
- **Enseignants** : rôle et fiche créés, mais pas encore d'affectation aux matières/classes
  ni de groupes (module 7).
- **Politique de confidentialité** provisoire, à faire relire juridiquement.
- **Limitation des essais de connexion** : assurée par Supabase Auth (limites par défaut
  du projet) ; la limitation des codes de liaison est, elle, implémentée en base.
- **Purge** de `invitation_attempts` (> 30 jours) : à planifier (pg_cron ou tâche
  externe).

## Limites inhérentes à une PWA (à garder en tête pour la suite)

- La consultation parentale distante nécessite que l'élève ait synchronisé ses données.
- Les notifications distantes nécessitent un service réseau ; elles ne peuvent pas être
  instantanées quand l'appareil de l'élève est hors ligne.
- Une ressource non téléchargée peut être indisponible hors ligne.
- L'espace de stockage local dépend de l'appareil et du navigateur, et peut être libéré
  par le système (iOS en particulier) ; la persistance sera demandée via
  `navigator.storage.persist()` sans garantie.
- Les tâches d'arrière-plan (Background Sync) ne sont pas disponibles dans tous les
  navigateurs : la synchronisation se fera surtout à l'ouverture de l'application.
- Une PWA ne garantit pas toutes les fonctions d'une application native.
- Un examen passé hors ligne n'est pas inviolable : les données locales peuvent être
  modifiées par la personne qui contrôle l'appareil.

## Performance

Build actuel : environ 200 ko compressés pour le premier chargement (React, routeur,
supabase-js). Les pages sont découpées et chargées à la demande. Une mesure Lighthouse
sur appareil Android d'entrée de gamme est prévue au module 12.
