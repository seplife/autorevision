-- =============================================================================
-- Migration 0004 — Paramètres de la plateforme et données de référence minimales
-- =============================================================================

create table public.platform_settings (
  id                 boolean primary key default true check (id),  -- ligne unique
  platform_name      text not null default 'Réussite Scolaire CI'
                       check (char_length(btrim(platform_name)) between 2 and 60),
  slogan             text not null default 'Apprendre, s''entraîner, réussir'
                       check (char_length(slogan) <= 120),
  -- Seuil interne de « chapitre maîtrisé ». Ce n'est PAS une norme officielle.
  mastery_threshold  numeric(5,2) not null default 80
                       check (mastery_threshold between 50 and 100),
  timezone           text not null default 'Africa/Abidjan',
  currency           text not null default 'XOF',
  updated_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now()
);

create or replace function public.platform_settings_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  perform public.write_audit('parametres.modifies', 'platform_settings', 'true',
    jsonb_build_object('platform_name', new.platform_name,
                       'mastery_threshold', new.mastery_threshold));
  return new;
end;
$$;
revoke execute on function public.platform_settings_guard() from public, anon, authenticated;

create trigger platform_settings_guard before update on public.platform_settings
  for each row execute function public.platform_settings_guard();

revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
grant update (platform_name, slogan, mastery_threshold) on public.platform_settings to authenticated;
alter table public.platform_settings enable row level security;
create policy platform_settings_select on public.platform_settings
  for select to anon, authenticated using (true);
create policy platform_settings_update_admin on public.platform_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.platform_settings (id) values (true) on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Données de référence : classes et séries prioritaires du projet.
-- Il s'agit de la STRUCTURE (classes, séries) demandée par le cahier des charges,
-- pas d'un programme. Aucune matière ni aucun chapitre n'est créé ici : ils
-- doivent être saisis à partir des référentiels officiels vérifiés.
--
-- Hypothèse documentée : la série A est créée comme une seule série « A ».
-- Si le référentiel vérifié distingue plusieurs séries (par ex. A1 / A2),
-- l'administration peut en ajouter sans migration.
-- -----------------------------------------------------------------------------

insert into public.grade_levels (code, label, cycle, position, exam_name) values
  ('3E',  'Troisième', 'premier_cycle', 30, 'BEPC'),
  ('TLE', 'Terminale', 'second_cycle',  70, 'BAC')
on conflict (code) do nothing;

insert into public.academic_series (grade_level_id, code, label)
select g.id, s.code, s.label
from public.grade_levels g
cross join (values ('A', 'Série A'), ('D', 'Série D')) as s(code, label)
where g.code = 'TLE'
on conflict (grade_level_id, code) do nothing;

-- Année scolaire courante : dates laissées vides tant que le calendrier officiel
-- n'a pas été vérifié.
insert into public.school_years (label, is_current) values ('2026-2027', true)
on conflict (label) do nothing;
