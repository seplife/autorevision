-- =============================================================================
-- Migration 0001 — Fondations
-- Extensions, types énumérés partagés et fonction utilitaire de mise à jour.
-- =============================================================================

-- Sur Supabase, pgcrypto est déjà installée dans le schéma « extensions ».
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Rôles applicatifs. L'ordre n'implique aucune hiérarchie implicite :
-- chaque permission est accordée explicitement dans les politiques.
create type public.app_role as enum (
  'eleve',
  'parent',
  'enseignant',
  'responsable_pedagogique',
  'administrateur'
);

-- Statut de vérification d'un élément du référentiel scolaire.
-- « valide » n'est possible qu'après vérification humaine documentée (voir contraintes).
create type public.verification_status as enum (
  'a_verifier',
  'en_verification',
  'valide'
);

create type public.link_status as enum ('actif', 'revoque');

-- Mise à jour automatique de updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Supabase accorde EXECUTE à anon/authenticated par défaut : on le retire explicitement.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
