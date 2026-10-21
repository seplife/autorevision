# Cahier des charges fonctionnel (synthèse)

Référence complète : le « prompt maître » fourni par le porteur du projet. Ce document en
résume les exigences et précise les hypothèses retenues.

## Périmètre

- Pays : Côte d'Ivoire ; langue : français ; fuseau : Africa/Abidjan ; devise : XOF.
- Classes prioritaires : 3e (BEPC), Terminale A et Terminale D (BAC). Architecture
  ouverte aux autres classes, séries et établissements.
- Utilisateurs : élève, parent/tuteur, enseignant, responsable pédagogique,
  administrateur.

## Exigences principales

1. Référentiel par classe → série → matière → programme → chapitre → compétences et
   objectifs, avec statut de vérification et références officielles.
2. Modèle pédagogique en 10 étapes par chapitre (objectifs, prérequis, cours, fiche,
   vérification, exercices de niveaux 1 à 4, correction, évaluation, remédiation,
   validation à seuil configurable non officiel).
3. Moteur d'exercices multi-types, correction déterministe, barème, chronomètre, reprise,
   distinction correction automatique / humaine.
4. Parcours BEPC et BAC A/D, examens blancs, planning de révision avec révision espacée.
5. Espace parent : enfants liés uniquement, indicateurs expliqués, date de dernière
   synchronisation, alertes configurables.
6. Hors ligne : PWA installable, téléchargement par chapitre/matière/classe/pack, IndexedDB,
   file de synchronisation idempotente, conflits gérés par type de donnée, migrations
   locales sans perte.
7. Workflow éditorial à 7 statuts, versions stables, traçabilité, catégories de sujets.
8. Sécurité : RLS partout, opérations sensibles côté serveur, audit, aucun secret dans le
   frontend, protection des mineurs.
9. Accessibilité WCAG 2.2 AA visée, performance sur appareils modestes.

## Hypothèses retenues (documentées)

- La série A est une série unique « A » tant que le référentiel n'a pas été vérifié.
- Seuls « élève » et « parent » sont auto-déclarables à l'inscription.
- Liaison parent-enfant par code à usage unique (48 h, 5 essais erronés/heure).
- Année scolaire 2026-2027 créée sans dates (calendrier officiel à vérifier).
- Seuil de maîtrise par défaut : 80 %, borné entre 50 et 100, présenté comme interne.

## Critères d'acceptation

Voir section 24 du prompt maître ; leur couverture est suivie dans `ETAT_DU_PROJET.md`.
