-- =============================================================================
-- Migration 0005 — Cours et circuit de publication
--
-- Circuit : brouillon → en_redaction → soumis → (a_corriger | valide) → publie → archive
--
-- Règles imposées en base (pas seulement dans l'interface) :
--  * aucune écriture directe : tout passe par course_save / course_transition ;
--  * la validation et la publication sont réservées au staff pédagogique, et le
--    validateur ne peut pas être l'auteur du cours ;
--  * un cours ne peut être publié que si son programme est « validé » ;
--  * chaque publication fige une version immuable (course_versions) ;
--  * les élèves ne voient que la version publiée.
-- =============================================================================

create type public.content_status as enum (
  'brouillon', 'en_redaction', 'soumis', 'a_corriger', 'valide', 'publie', 'archive'
);

create table public.courses (
  id                    uuid primary key default gen_random_uuid(),
  chapter_id            uuid not null references public.chapters (id) on delete restrict,
  title                 text not null check (char_length(btrim(title)) between 1 and 200),
  body                  text not null default '' check (char_length(body) <= 100000),
  status                public.content_status not null default 'brouillon',
  author_id             uuid not null references public.profiles (id) on delete restrict,
  review_comment        text,
  validated_by          uuid references public.profiles (id) on delete set null,
  validated_at          timestamptz,
  published_version_id  uuid,
  published_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index courses_chapter_idx on public.courses (chapter_id);
create index courses_author_idx on public.courses (author_id);
create index courses_status_idx on public.courses (status);

create table public.course_versions (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses (id) on delete cascade,
  version_number  int  not null check (version_number >= 1),
  title           text not null,
  body            text not null,
  published_by    uuid references public.profiles (id) on delete set null,
  published_at    timestamptz not null default now(),
  unique (course_id, version_number)
);

alter table public.courses
  add constraint courses_published_version_fk
  foreign key (published_version_id) references public.course_versions (id) on delete set null;

alter table public.courses
  add constraint courses_publie_coherent check (
    status <> 'publie' or (published_version_id is not null and published_at is not null)
  );

create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

-- Les versions publiées sont immuables.
create or replace function public.course_versions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'version_immuable' using errcode = '42501';
end;
$$;
create trigger course_versions_immutable before update on public.course_versions
  for each row execute function public.course_versions_immutable();

-- -----------------------------------------------------------------------------
-- Enregistrement d'un cours (création ou modification par son auteur)
-- -----------------------------------------------------------------------------
create or replace function public.course_save(
  p_id uuid, p_chapter_id uuid, p_title text, p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course public.courses;
  v_id uuid;
begin
  if v_uid is null or not (public.has_role('enseignant') or public.is_staff_pedagogique()) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'titre_requis' using errcode = '22023';
  end if;
  if not exists (select 1 from public.chapters where id = p_chapter_id) then
    raise exception 'chapitre_introuvable' using errcode = 'P0002';
  end if;

  if p_id is null then
    insert into public.courses (chapter_id, title, body, author_id)
    values (p_chapter_id, btrim(p_title), coalesce(p_body, ''), v_uid)
    returning id into v_id;
    perform public.write_audit('cours.cree', 'courses', v_id::text, '{}'::jsonb);
    return v_id;
  end if;

  select * into v_course from public.courses where id = p_id for update;
  if not found then
    raise exception 'cours_introuvable' using errcode = 'P0002';
  end if;
  if v_course.author_id <> v_uid then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if v_course.status not in ('brouillon', 'en_redaction', 'a_corriger') then
    raise exception 'cours_non_modifiable' using errcode = '55000';
  end if;

  update public.courses
     set chapter_id = p_chapter_id,
         title = btrim(p_title),
         body = coalesce(p_body, ''),
         status = case when status = 'brouillon' then 'en_redaction'::public.content_status else status end
   where id = p_id;
  return p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Changement de statut
-- -----------------------------------------------------------------------------
create or replace function public.course_transition(
  p_id uuid, p_to public.content_status, p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course public.courses;
  v_is_author boolean;
  v_staff boolean := public.is_staff_pedagogique();
  v_version_id uuid;
  v_next int;
begin
  if v_uid is null then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  select * into v_course from public.courses where id = p_id for update;
  if not found then
    raise exception 'cours_introuvable' using errcode = 'P0002';
  end if;
  v_is_author := v_course.author_id = v_uid;

  -- Soumission : par l'auteur uniquement, contenu non vide.
  if p_to = 'soumis' then
    if not v_is_author or v_course.status not in ('brouillon', 'en_redaction', 'a_corriger') then
      raise exception 'transition_interdite' using errcode = '42501';
    end if;
    if btrim(v_course.body) = '' then
      raise exception 'contenu_requis' using errcode = '22023';
    end if;
    update public.courses set status = 'soumis', review_comment = null where id = p_id;

  -- Demande de correction : staff, jamais sur son propre cours.
  elsif p_to = 'a_corriger' then
    if not v_staff or v_is_author or v_course.status not in ('soumis', 'valide') then
      raise exception 'transition_interdite' using errcode = '42501';
    end if;
    if p_comment is null or btrim(p_comment) = '' then
      raise exception 'commentaire_requis' using errcode = '22023';
    end if;
    update public.courses
       set status = 'a_corriger', review_comment = btrim(p_comment),
           validated_by = null, validated_at = null
     where id = p_id;

  -- Validation pédagogique : staff, distinct de l'auteur.
  elsif p_to = 'valide' then
    if not v_staff or v_is_author or v_course.status <> 'soumis' then
      raise exception 'transition_interdite' using errcode = '42501';
    end if;
    update public.courses
       set status = 'valide', validated_by = v_uid, validated_at = now(), review_comment = null
     where id = p_id;

  -- Publication : fige une version ; le programme doit être validé.
  elsif p_to = 'publie' then
    if not v_staff or v_course.status <> 'valide' then
      raise exception 'transition_interdite' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.chapters ch
      join public.curricula cu on cu.id = ch.curriculum_id
      where ch.id = v_course.chapter_id and cu.verification_status = 'valide'
    ) then
      raise exception 'programme_non_valide' using errcode = '55000';
    end if;
    select coalesce(max(version_number), 0) + 1 into v_next
      from public.course_versions where course_id = p_id;
    insert into public.course_versions (course_id, version_number, title, body, published_by)
    values (p_id, v_next, v_course.title, v_course.body, v_uid)
    returning id into v_version_id;
    update public.courses
       set status = 'publie', published_version_id = v_version_id, published_at = now()
     where id = p_id;

  -- Archivage : staff.
  elsif p_to = 'archive' then
    if not v_staff or v_course.status <> 'publie' then
      raise exception 'transition_interdite' using errcode = '42501';
    end if;
    update public.courses
       set status = 'archive', published_version_id = null, published_at = null
     where id = p_id;

  -- Réouverture d'un cours archivé pour une nouvelle version.
  elsif p_to = 'brouillon' then
    if not v_staff or v_course.status <> 'archive' then
      raise exception 'transition_interdite' using errcode = '42501';
    end if;
    update public.courses
       set status = 'brouillon', validated_by = null, validated_at = null
     where id = p_id;

  else
    raise exception 'transition_interdite' using errcode = '42501';
  end if;

  perform public.write_audit('cours.statut', 'courses', p_id::text,
    jsonb_build_object('de', v_course.status, 'vers', p_to));
end;
$$;

-- -----------------------------------------------------------------------------
-- Suppression d'un cours (interdite tant qu'il est en statut « publié »)
-- -----------------------------------------------------------------------------
create or replace function public.course_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course public.courses;
  v_staff boolean := public.is_staff_pedagogique();
begin
  if v_uid is null then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  select * into v_course from public.courses where id = p_id for update;
  if not found then
    raise exception 'cours_introuvable' using errcode = 'P0002';
  end if;
  if v_course.status = 'publie' then
    raise exception 'cours_publie_non_supprimable' using errcode = '55000';
  end if;
  if not (
    v_staff
    or (v_course.author_id = v_uid and v_course.status in ('brouillon', 'en_redaction', 'a_corriger'))
  ) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;

  delete from public.courses where id = p_id;
  perform public.write_audit('cours.supprime', 'courses', p_id::text,
    jsonb_build_object('title', v_course.title, 'status', v_course.status));
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilèges et RLS : lecture seule en direct, écriture via les fonctions
-- -----------------------------------------------------------------------------
revoke all on public.courses, public.course_versions from anon, authenticated;
grant select on public.courses, public.course_versions to authenticated;

alter table public.courses enable row level security;
alter table public.course_versions enable row level security;

create policy courses_select on public.courses for select to authenticated
  using (status = 'publie' or author_id = auth.uid() or public.is_staff_pedagogique());

create policy course_versions_select on public.course_versions for select to authenticated
  using (
    public.is_staff_pedagogique()
    or exists (
      select 1 from public.courses c
      where c.id = course_versions.course_id
        and (c.author_id = auth.uid() or c.published_version_id = course_versions.id)
    )
  );

revoke execute on function
  public.course_save(uuid, uuid, text, text),
  public.course_transition(uuid, public.content_status, text),
  public.course_delete(uuid),
  public.course_versions_immutable()
from public, anon, authenticated;
grant execute on function
  public.course_save(uuid, uuid, text, text),
  public.course_transition(uuid, public.content_status, text),
  public.course_delete(uuid)
to authenticated;
