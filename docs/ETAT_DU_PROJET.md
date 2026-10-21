# État réel du projet

Dernière mise à jour : 17/10/2026 — fin du **module 1** (fondations, authentification,
rôles, liaison parent-enfant, référentiel de base).

## Résultats des tests exécutés (17/10/2026)

| Suite | Commande | Résultat |
|---|---|---|
| Typage strict (app + outillage) | `npm run typecheck` | ✅ aucune erreur |
| Unitaires et composants (jsdom) | `npm test` | ✅ 34 / 34 (7 fichiers) |
| Base de données : migrations + RLS (PostgreSQL 16 réel, émulation Supabase Auth) | `npm run test:integration` | ✅ 36 / 36 (3 fichiers) |
| Bout en bout (Chromium bureau + profil Pixel 5) | `npm run test:e2e` | ✅ 12 / 12 |
| Build de production + Service Worker | `npm run build` | ✅ 37 fichiers précachés (≈ 819 Kio) |

Les tests ont révélé et permis de corriger trois défauts réels pendant le module : une
fonction exécutable par les visiteurs anonymes (droits par défaut de Supabase), un e-mail
saisi avec des espaces rejeté au lieu d'être nettoyé, et une confirmation de mot de passe
non signalée tant que d'autres champs étaient invalides.

## Fonctionnalités opérationnelles

**Base de données (4 migrations)**
- Profils, rôles, fiches élève / parent / enseignant, journal d'audit ; RLS sur toutes les
  tables (test automatique), aucune fonction exécutable par `anon` (test automatique),
  `search_path` fixé sur toutes les fonctions `SECURITY DEFINER` (test automatique).
- Inscription : seuls « élève » et « parent » sont auto-déclarables ; toute demande de rôle
  privilégié est ignorée (testé).
- Gestion des rôles uniquement via `admin_grant_role` / `admin_revoke_role` : réservé aux
  administrateurs, interdiction de se modifier soi-même, audit (testé).
- Liaison parent-enfant par code : 8 caractères, 40 bits d'aléa, hachage SHA-256 seul
  stocké et illisible par les clients, usage unique, 48 h, nouveau code = ancien annulé,
  blocage après 5 essais erronés par heure, révocation par l'une ou l'autre partie,
  historique conservé (tout testé). Un parent non lié ne voit rien, même avec
  l'identifiant de l'enfant ; un parent dont le rôle est retiré perd l'accès (testé).
- Référentiel : années, classes, séries, matières, programmes, références, chapitres,
  compétences, objectifs. Lecture publique, écriture réservée au personnel pédagogique
  (enseignants exclus, testé). Validation d'un programme impossible sans organisme et
  référence ; validateur et date imposés par le serveur ; audit (testé). Série
  obligatoirement cohérente avec la classe (testé).
- Données de référence : 3e (BEPC), Terminale (BAC) avec séries A et D, année 2026-2027.
  **Aucune matière ni chapitre inventé** (testé).
- Paramètres : nom, slogan, seuil de maîtrise (50–100, non officiel), modifiables par
  l'administrateur seul (testé).

**Application**
- Coquille PWA : manifeste, icônes (dont maskable), Service Worker Workbox, mise à jour
  sur accord de l'utilisateur, bouton d'installation quand le navigateur le propose,
  ouverture en mode avion après une première visite (testé sur Chromium).
- Indicateur de connexion fondé sur une vraie vérification du serveur (requête de santé
  avec délai maximal et recul progressif), pas sur le seul événement `online`.
- Authentification Supabase réelle : inscription, confirmation par e-mail, connexion,
  déconnexion, récupération et changement de mot de passe ; messages d'erreur en français
  sans détail technique ; écran « Configuration requise » si aucun serveur n'est configuré.
- Gardes de routes par rôle (confort d'interface ; la sécurité réelle est en base).
- Espace élève : tableau de bord, choix de classe/série, génération du code de liaison,
  liste et révocation des parents liés.
- Espace parent : saisie du code, enfants liés avec leur classe, révocation.
- Espace pédagogique : compteurs réels du référentiel (matières, programmes, programmes
  validés, chapitres).
- Administration : recherche et pagination des comptes, attribution/retrait de rôles avec
  confirmation, paramètres de la plateforme.
- Paramètres et aide : nom affiché, thème clair/sombre/système, état de connexion,
  confidentialité.
- Accessibilité : lien d'évitement, libellés et erreurs reliés aux champs, cibles tactiles
  ≥ 44 px, focus visible, mouvement réduit respecté, pas de défilement horizontal sur
  mobile (testé).

## Partiellement opérationnel

- Écrans connectés : non parcourus de bout en bout contre un vrai projet Supabase (pas
  d'identifiants, pas de Docker). La logique serveur qu'ils appellent est testée.
- Politique de confidentialité : texte provisoire à faire valider juridiquement.

## Restant à développer (modules 2 à 12)

Écrans de gestion du référentiel et couverture (2) · cours versionnés, workflow éditorial,
Storage (3) · moteur d'exercices et d'évaluations (4) · progression et remédiation (5) ·
tableau de bord parental complet et alertes (6) · affectations enseignants, validation,
statistiques (7) · téléchargements hors ligne et IndexedDB (8) · file de synchronisation,
conflits, tests mode avion complets (9) · planning de révision (10) · rapports (11) ·
optimisation, audit sécurité/accessibilité (12). Également : écran de suppression de
compte, purge planifiée des tentatives, Edge Functions (aucune n'est encore nécessaire).

## Critères d'acceptation (section 24) — couverture actuelle

| Critère | État |
|---|---|
| Un élève peut se connecter | ✅ (Supabase Auth ; non testé contre un projet réel) |
| Sélectionner sa classe et sa série | ✅ |
| Consulter un contenu / télécharger un chapitre / étudier en mode avion / exercice hors ligne | ❌ modules 3, 4, 8 |
| Réponses conservées après fermeture, synchronisées sans doublon | ❌ modules 8, 9 |
| Parent autorisé voit les résultats ; parent non autorisé ne voit rien | ✅ pour l'accès aux données de l'enfant ; résultats : module 5–6 |
| Enseignant soumet / responsable valide un contenu | ⚠️ validation des programmes faite ; contenus : module 3 |
| Administrateur gère référentiels et permissions | ✅ permissions (écran) ; référentiel en base, écran au module 2 |
| Brouillons / validés / sujets officiels distingués | ⚠️ statuts du référentiel faits ; contenus et sujets : modules 3–4 |
| Erreurs réseau gérées | ✅ pour l'authentification et la connectivité |
| Migrations documentées, tests critiques exécutés, installation documentée, limites connues | ✅ |

## Démarrage

Voir `README.md`, `GUIDE_SUPABASE.md` et `GUIDE_WINDOWS.md`. Configuration encore
nécessaire de votre côté : un projet Supabase, l'application des migrations, la création
du premier administrateur, un SMTP pour les e-mails.
