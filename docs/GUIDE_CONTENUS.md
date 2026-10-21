# Création et validation des contenus pédagogiques

> Module 1 : seul le **référentiel** (classes, séries, matières, programmes, chapitres,
> compétences, objectifs) existe en base. Les écrans de saisie arrivent au module 2 ;
> les cours et exercices au module 3–4. Ce guide décrit les règles, dont celles qui sont
> déjà imposées par la base.

## Règle de base

Aucun contenu inventé ne doit être présenté comme un programme officiel ivoirien. La
plateforme démarre **sans aucune matière ni chapitre** : ils doivent être saisis à partir
des référentiels officiels en vigueur.

## Circuit de vérification d’un programme (déjà appliqué en base)

1. Un responsable pédagogique (ou administrateur) crée la matière et le programme
   (classe, série éventuelle, année scolaire). Statut initial : **À vérifier**.
2. Il renseigne l’**organisme émetteur**, la **référence du document officiel** et sa date,
   et ajoute les références consultées (`curriculum_references`).
3. Il saisit chapitres, compétences et objectifs.
4. Passage en **Validé pédagogiquement** : la base **refuse** ce statut si l’organisme ou la
   référence manquent. Le validateur et la date sont fixés par le serveur (impossible
   d’attribuer la validation à quelqu’un d’autre). Le changement est inscrit au journal
   d’audit.
5. Revenir à « À vérifier » efface la validation.

Si le programme officiel n’est pas disponible, laissez le programme « À vérifier » avec
une structure vide : n’en inventez pas le contenu.

## Statuts des contenus (modules 3 et suivants)

Brouillon → En cours de rédaction → Soumis à vérification → À corriger →
Validé pédagogiquement → Publié → Archivé. Chaque version publiée sera figée pour que les
tentatives d’évaluation gardent une référence stable.

## Sujets d’examen

Quatre catégories seront toujours affichées distinctement : sujet officiel authentifié ;
sujet officiel dont l’authenticité reste à vérifier ; sujet d’entraînement créé par
l’équipe ; sujet généré avec assistance d’IA. Seule la première peut être présentée comme
officielle. Enregistrer provenance, année et statut de vérification.

## Droits d’utilisation

Utiliser prioritairement les programmes officiels et des ressources dont l’usage est
autorisé ; ne pas importer de manuels commerciaux sans autorisation.

## Hypothèse à vérifier

La série A est créée comme une seule série « A ». Si le référentiel officiel vérifié
distingue des sous-séries (par exemple A1 et A2), l’administration peut les ajouter
sans migration.
