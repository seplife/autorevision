-- =============================================================================
-- Migration 0003 — Référentiel scolaire
--
-- La structure permet de décrire n'importe quelle classe / série / matière.
-- Aucun programme n'est considéré comme officiel tant qu'il n'a pas été validé
-- par un responsable pédagogique avec une référence documentaire vérifiable
-- (contrainte en base, pas seulement dans l'interface).
-- =============================================================================

create table public.school_years (
  id          uuid primary key default gen_random_uuid(),
  label       text not null unique check (label ~ '^[0-9]{4}-[0-9]{4}$'),
  starts_on   date,
  ends_on     date,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on > starts_on)
);
create unique index school_years_one_current on public.school_years (is_current) where is_current;

create table public.grade_levels (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9_]{1,16}$'),
  label       text not null check (char_length(btrim(label)) between 1 and 60),
  cycle       text not null check (cycle in ('premier_cycle', 'second_cycle')),
  position    int  not null default 0,
  exam_name   text,          -- ex. BEPC, BAC ; null si la classe ne prépare pas d'examen
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.academic_series (
  id              uuid primary key default gen_random_uuid(),
  grade_level_id  uuid not null references public.grade_levels (id) on delete restrict,
  code            text not null check (code ~ '^[A-Z0-9_]{1,8}$'),
  label           text not null check (char_length(btrim(label)) between 1 and 60),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (grade_level_id, code),
  unique (id, grade_level_id)   -- cible de la clé composite « série ∈ classe »
);

create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9_]{1,16}$'),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.curricula (
  id                   uuid primary key default gen_random_uuid(),
  grade_level_id       uuid not null references public.grade_levels (id) on delete restrict,
  series_id            uuid,
  subject_id           uuid not null references public.subjects (id) on delete restrict,
  school_year_id       uuid references public.school_years (id) on delete restrict,
  title                text not null check (char_length(btrim(title)) between 1 and 160),
  verification_status  public.verification_status not null default 'a_verifier',
  issuing_body         text,   -- organisme émetteur (ex. direction compétente du ministère)
  document_reference   text,   -- référence du document officiel
  document_date        date,
  verified_by          uuid references public.profiles (id) on delete set null,
  verified_at          timestamptz,
  notes                text,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (series_id, grade_level_id)
    references public.academic_series (id, grade_level_id) on delete restrict,
  constraint curricula_valide_documente check (
    verification_status <> 'valide' or (
      issuing_body is not null and btrim(issuing_body) <> ''
      and document_reference is not null and btrim(document_reference) <> ''
      and verified_by is not null and verified_at is not null
    )
  ),
  unique nulls not distinct (grade_level_id, series_id, subject_id, school_year_id)
);
create index curricula_subject_idx on public.curricula (subject_id);
create index curricula_grade_idx on public.curricula (grade_level_id, series_id);

create table public.curriculum_references (
  id             uuid primary key default gen_random_uuid(),
  curriculum_id  uuid not null references public.curricula (id) on delete cascade,
  title          text not null,
  issuer         text,
  reference      text,
  url            text check (url is null or url ~ '^https?://'),
  published_on   date,
  consulted_on   date,
  created_at     timestamptz not null default now()
);
create index curriculum_references_curriculum_idx on public.curriculum_references (curriculum_id);

create table public.chapters (
  id                   uuid primary key default gen_random_uuid(),
  curriculum_id        uuid not null references public.curricula (id) on delete cascade,
  parent_chapter_id    uuid references public.chapters (id) on delete cascade,
  title                text not null check (char_length(btrim(title)) between 1 and 200),
  position             int  not null default 0,
  is_mandatory         boolean not null default true,
  verification_status  public.verification_status not null default 'a_verifier',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (parent_chapter_id is null or parent_chapter_id <> id)
);
create index chapters_curriculum_idx on public.chapters (curriculum_id, position);
create index chapters_parent_idx on public.chapters (parent_chapter_id);

create table public.competencies (
  id             uuid primary key default gen_random_uuid(),
  curriculum_id  uuid not null references public.curricula (id) on delete cascade,
  code           text not null,
  description    text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (curriculum_id, code)
);

create table public.learning_objectives (
  id             uuid primary key default gen_random_uuid(),
  chapter_id     uuid not null references public.chapters (id) on delete cascade,
  competency_id  uuid references public.competencies (id) on delete set null,
  description    text not null,
  position       int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index learning_objectives_chapter_idx on public.learning_objectives (chapter_id, position);
create index learning_objectives_competency_idx on public.learning_objectives (competency_id);

-- updated_at
create trigger school_years_updated_at before update on public.school_years for each row execute function public.set_updated_at();
create trigger grade_levels_updated_at before update on public.grade_levels for each row execute function public.set_updated_at();
create trigger academic_series_updated_at before update on public.academic_series for each row execute function public.set_updated_at();
create trigger subjects_updated_at before update on public.subjects for each row execute function public.set_updated_at();
create trigger curricula_updated_at before update on public.curricula for each row execute function public.set_updated_at();
create trigger chapters_updated_at before update on public.chapters for each row execute function public.set_updated_at();
create trigger competencies_updated_at before update on public.competencies for each row execute function public.set_updated_at();
create trigger learning_objectives_updated_at before update on public.learning_objectives for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Rattachement de l'élève au référentiel
-- -----------------------------------------------------------------------------

alter table public.students
  add constraint students_grade_level_fk
    foreign key (grade_level_id) references public.grade_levels (id) on delete set null,
  add constraint students_series_in_grade_fk
    foreign key (series_id, grade_level_id)
    references public.academic_series (id, grade_level_id) on delete set null (series_id),
  add constraint students_school_year_fk
    foreign key (school_year_id) references public.school_years (id) on delete set null;
create index students_grade_idx on public.students (grade_level_id, series_id);

-- -----------------------------------------------------------------------------
-- Validation des programmes : le validateur et la date sont fixés par le serveur
-- -----------------------------------------------------------------------------

create or replace function public.curricula_verification_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verification_status = 'valide'
     and (tg_op = 'INSERT' or old.verification_status is distinct from 'valide') then
    -- Impossible de se déclarer validateur à la place d'un autre.
    new.verified_by := auth.uid();
    new.verified_at := now();
  elsif new.verification_status <> 'valide' then
    new.verified_by := null;
    new.verified_at := null;
  elsif tg_op = 'UPDATE' then
    -- Reste « valide » : on interdit la réécriture du validateur.
    new.verified_by := old.verified_by;
    new.verified_at := old.verified_at;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;

  if tg_op = 'UPDATE' and new.verification_status is distinct from old.verification_status then
    perform public.write_audit('programme.statut', 'curricula', new.id::text,
      jsonb_build_object('de', old.verification_status, 'vers', new.verification_status));
  end if;
  return new;
end;
$$;
revoke execute on function public.curricula_verification_guard() from public, anon, authenticated;

create trigger curricula_verification_guard
  before insert or update on public.curricula
  for each row execute function public.curricula_verification_guard();

-- -----------------------------------------------------------------------------
-- Privilèges et RLS
-- Lecture : le catalogue est public (y compris visiteurs non connectés), avec
-- son statut de vérification visible. Écriture : responsables pédagogiques et
-- administrateurs uniquement.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'school_years', 'grade_levels', 'academic_series', 'subjects', 'curricula',
    'curriculum_references', 'chapters', 'competencies', 'learning_objectives'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_staff_pedagogique())',
      t || '_insert_staff', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_staff_pedagogique()) with check (public.is_staff_pedagogique())',
      t || '_update_staff', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_staff_pedagogique())',
      t || '_delete_staff', t);
  end loop;
end;
$$;
