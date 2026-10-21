-- =============================================================================
-- Migration 0007 — Pièce jointe (PDF) sur les cours et versions publiées
-- =============================================================================

alter table public.courses
  add column if not exists attachment_path text,
  add column if not exists attachment_name text;

alter table public.course_versions
  add column if not exists attachment_path text,
  add column if not exists attachment_name text;

-- -----------------------------------------------------------------------------
-- Bucket Supabase Storage « course-files » (public en lecture, écriture staff/enseignant)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('course-files', 'course-files', true, 15728640, array['application/pdf'])
    on conflict (id) do update
      set public = true,
          file_size_limit = 15728640,
          allowed_mime_types = array['application/pdf'];

    drop policy if exists course_files_select on storage.objects;
    create policy course_files_select on storage.objects for select to anon, authenticated
      using (bucket_id = 'course-files');

    drop policy if exists course_files_insert on storage.objects;
    create policy course_files_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'course-files'
        and (public.has_role('enseignant') or public.is_staff_pedagogique())
      );

    drop policy if exists course_files_delete on storage.objects;
    create policy course_files_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'course-files'
        and (owner = auth.uid() or public.is_staff_pedagogique())
      );
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Mise à jour de course_save pour accepter une pièce jointe PDF
-- -----------------------------------------------------------------------------
drop function if exists public.course_save(uuid, uuid, text, text);

create or replace function public.course_save(
  p_id uuid,
  p_chapter_id uuid,
  p_title text,
  p_body text,
  p_attachment_path text default null,
  p_attachment_name text default null
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
    insert into public.courses (chapter_id, title, body, author_id, attachment_path, attachment_name)
    values (
      p_chapter_id,
      btrim(p_title),
      coalesce(p_body, ''),
      v_uid,
      nullif(btrim(coalesce(p_attachment_path, '')), ''),
      nullif(btrim(coalesce(p_attachment_name, '')), '')
    )
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
         attachment_path = nullif(btrim(coalesce(p_attachment_path, '')), ''),
         attachment_name = nullif(btrim(coalesce(p_attachment_name, '')), ''),
         status = case when status = 'brouillon' then 'en_redaction'::public.content_status else status end
   where id = p_id;
  return p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Mise à jour de course_transition : autoriser un cours qui a un PDF ou du texte,
-- et copier le PDF dans la version figée lors de la publication
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

  -- Soumission : par l'auteur uniquement, contenu texte ou document PDF requis.
  if p_to = 'soumis' then
    if not v_is_author or v_course.status not in ('brouillon', 'en_redaction', 'a_corriger') then
      raise exception 'transition_interdite' using errcode = '42501';
    end if;
    if btrim(v_course.body) = '' and (v_course.attachment_path is null or btrim(v_course.attachment_path) = '') then
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

  -- Publication : fige une version (texte + PDF) ; le programme doit être validé.
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
    insert into public.course_versions (
      course_id, version_number, title, body, attachment_path, attachment_name, published_by
    )
    values (
      p_id, v_next, v_course.title, v_course.body, v_course.attachment_path, v_course.attachment_name, v_uid
    )
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

revoke execute on function
  public.course_save(uuid, uuid, text, text, text, text),
  public.course_transition(uuid, public.content_status, text)
from public, anon, authenticated;
grant execute on function
  public.course_save(uuid, uuid, text, text, text, text),
  public.course_transition(uuid, public.content_status, text)
to authenticated;
