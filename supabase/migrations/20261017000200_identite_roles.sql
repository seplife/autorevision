-- =============================================================================
-- Migration 0002 — Identité, rôles, liaison parent-enfant, journal d'audit
--
-- Règles de sécurité appliquées ici :
--  * RLS activée sur toutes les tables.
--  * Aucune écriture directe possible sur user_roles, parent_student_links,
--    invitations, audit_logs : seules des fonctions SECURITY DEFINER contrôlées
--    les modifient, en s'appuyant sur auth.uid() (jamais sur un identifiant fourni
--    par le navigateur pour décider d'une permission).
--  * Seuls les rôles « eleve » et « parent » peuvent être choisis à l'inscription.
--  * Aucun utilisateur ne peut modifier ses propres rôles.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(btrim(display_name)) between 2 and 80),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is
  'Profil public minimal de chaque compte. L''e-mail reste dans auth.users.';

create table public.user_roles (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.app_role not null,
  granted_by  uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role)
);
create index user_roles_role_idx on public.user_roles (role);
comment on table public.user_roles is
  'Rôles attribués. Modifiable uniquement par handle_new_user et admin_grant_role / admin_revoke_role.';

create table public.students (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  -- Clés étrangères vers le référentiel ajoutées par la migration 0003.
  grade_level_id  uuid,
  series_id       uuid,
  school_year_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.parents (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.teachers (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'liaison_parent' check (kind in ('liaison_parent')),
  student_id  uuid not null references public.students (user_id) on delete cascade,
  -- Seul le hachage du code est conservé ; le code en clair n'est montré qu'une fois.
  code_hash   bytea not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid references public.profiles (id) on delete set null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (expires_at > created_at)
);
create index invitations_student_idx on public.invitations (student_id, created_at desc);

create table public.parent_student_links (
  id             uuid primary key default gen_random_uuid(),
  parent_id      uuid not null references public.parents (user_id) on delete cascade,
  student_id     uuid not null references public.students (user_id) on delete cascade,
  status         public.link_status not null default 'actif',
  invitation_id  uuid references public.invitations (id) on delete set null,
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_by     uuid references public.profiles (id) on delete set null,
  check (parent_id <> student_id),
  check ((status = 'revoque') = (revoked_at is not null))
);
-- Un seul lien actif par couple parent / élève ; l'historique des liens révoqués est conservé.
create unique index parent_student_links_active_uniq
  on public.parent_student_links (parent_id, student_id) where status = 'actif';
create index parent_student_links_student_idx on public.parent_student_links (student_id);

-- Tentatives de saisie de code (limitation des essais). Aucune lecture par les clients.
create table public.invitation_attempts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  succeeded     boolean not null,
  attempted_at  timestamptz not null default now()
);
create index invitation_attempts_user_idx on public.invitation_attempts (user_id, attempted_at desc);
comment on table public.invitation_attempts is
  'Conservation : les lignes de plus de 30 jours peuvent être purgées (aucun usage au-delà de la limitation).';

create table public.audit_logs (
  id            bigint generated always as identity primary key,
  actor_id      uuid references public.profiles (id) on delete set null,
  action        text not null,
  target_table  text,
  target_id     text,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger parents_updated_at before update on public.parents
  for each row execute function public.set_updated_at();
create trigger teachers_updated_at before update on public.teachers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fonctions d'aide aux politiques (SECURITY DEFINER pour éviter la récursion RLS)
-- -----------------------------------------------------------------------------

create or replace function public.has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = _role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('administrateur');
$$;

create or replace function public.is_staff_pedagogique()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('administrateur') or public.has_role('responsable_pedagogique');
$$;

-- Vrai si l'utilisateur courant est un parent lié ACTIVEMENT à l'élève indiqué.
create or replace function public.is_parent_of(_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('parent') and exists (
    select 1 from public.parent_student_links l
    where l.parent_id = auth.uid()
      and l.student_id = _student_id
      and l.status = 'actif'
  );
$$;

-- Vrai si l'utilisateur courant est un élève lié activement au parent indiqué.
create or replace function public.is_child_of(_parent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.parent_student_links l
    where l.student_id = auth.uid()
      and l.parent_id = _parent_id
      and l.status = 'actif'
  );
$$;

-- Écriture interne dans le journal d'audit (non appelable par les clients).
create or replace function public.write_audit(
  _action text, _target_table text, _target_id text, _details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), _action, _target_table, _target_id, coalesce(_details, '{}'::jsonb));
$$;

-- -----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _name text;
  _type text;
begin
  _name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(_name) < 2 then
    _name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Utilisateur');
  end if;
  if char_length(_name) < 2 then
    _name := 'Utilisateur';
  end if;
  _name := left(_name, 80);

  insert into public.profiles (id, display_name) values (new.id, _name);

  -- Seuls « eleve » et « parent » peuvent être auto-déclarés. Toute autre valeur
  -- (y compris « administrateur ») est ignorée : le compte n'a alors aucun rôle
  -- tant qu'un administrateur ne lui en attribue pas.
  _type := new.raw_user_meta_data ->> 'account_type';
  if _type = 'eleve' then
    insert into public.students (user_id) values (new.id);
    insert into public.user_roles (user_id, role) values (new.id, 'eleve');
  elsif _type = 'parent' then
    insert into public.parents (user_id) values (new.id);
    insert into public.user_roles (user_id, role) values (new.id, 'parent');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Gestion des rôles par l'administration
-- -----------------------------------------------------------------------------

create or replace function public.admin_grant_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'auto_modification_interdite' using errcode = '42501',
      hint = 'Un autre administrateur doit modifier vos rôles.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'utilisateur_introuvable' using errcode = 'P0002';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (p_user_id, p_role, auth.uid())
  on conflict (user_id, role) do nothing;

  if p_role = 'eleve' then
    insert into public.students (user_id) values (p_user_id) on conflict do nothing;
  elsif p_role = 'parent' then
    insert into public.parents (user_id) values (p_user_id) on conflict do nothing;
  elsif p_role = 'enseignant' then
    insert into public.teachers (user_id) values (p_user_id) on conflict do nothing;
  end if;

  perform public.write_audit('role.attribue', 'user_roles', p_user_id::text,
    jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_revoke_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'auto_modification_interdite' using errcode = '42501',
      hint = 'Un autre administrateur doit modifier vos rôles.';
  end if;

  -- Les données (élève, parent, enseignant) sont conservées : seul le rôle est retiré.
  delete from public.user_roles where user_id = p_user_id and role = p_role;

  if found then
    perform public.write_audit('role.retire', 'user_roles', p_user_id::text,
      jsonb_build_object('role', p_role));
  end if;
end;
$$;

-- Liste paginée des comptes pour l'écran « Utilisateurs et rôles ».
create or replace function public.admin_list_users(
  p_search text default null, p_limit int default 50, p_offset int default 0
)
returns table (
  id uuid, display_name text, email text, roles public.app_role[], created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;

  return query
    select p.id, p.display_name, u.email::text,
           coalesce(array_agg(ur.role order by ur.role) filter (where ur.role is not null),
                    '{}'::public.app_role[]),
           p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.user_roles ur on ur.user_id = p.id
    where p_search is null
       or btrim(p_search) = ''
       or p.display_name ilike '%' || btrim(p_search) || '%'
       or u.email ilike '%' || btrim(p_search) || '%'
    group by p.id, u.email
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- Liaison parent-enfant par code à usage unique
-- -----------------------------------------------------------------------------

-- Alphabet sans caractères ambigus (pas de 0/O ni 1/I) : 32 symboles,
-- 8 caractères = 40 bits d'aléa. Combiné à la limite de 5 essais par heure,
-- un code ne peut pas être deviné en pratique pendant ses 48 h de validité.
create or replace function public.normalize_link_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
$$;

create or replace function public.hash_link_code(p_normalized text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to('rsci-liaison:' || p_normalized, 'UTF8'));
$$;

create or replace function public.create_parent_link_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- 24 lettres (sans I ni O) + 8 chiffres (sans 0 ni 1) = 32 symboles.
  _alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _bytes bytea;
  _raw text := '';
  _expires timestamptz := now() + interval '48 hours';
  _recent int;
  i int;
begin
  if auth.uid() is null or not public.has_role('eleve')
     or not exists (select 1 from public.students s where s.user_id = auth.uid()) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;

  select count(*) into _recent from public.invitations inv
  where inv.student_id = auth.uid() and inv.created_at > now() - interval '1 hour';
  if _recent >= 5 then
    raise exception 'trop_de_codes' using errcode = 'P0001',
      hint = 'Attendez une heure avant de générer un nouveau code.';
  end if;

  -- Un seul code actif à la fois : les précédents non utilisés sont annulés.
  update public.invitations inv set revoked_at = now()
  where inv.student_id = auth.uid() and inv.used_at is null and inv.revoked_at is null;

  _bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    -- 256 est un multiple de 32 : le modulo ne biaise pas la distribution.
    _raw := _raw || substr(_alphabet, (get_byte(_bytes, i) % 32) + 1, 1);
  end loop;

  insert into public.invitations (student_id, code_hash, expires_at)
  values (auth.uid(), public.hash_link_code(_raw), _expires);

  perform public.write_audit('liaison.code_cree', 'invitations', auth.uid()::text, '{}'::jsonb);

  code := substr(_raw, 1, 4) || '-' || substr(_raw, 5, 4);
  expires_at := _expires;
  return next;
end;
$$;

-- Retourne un statut plutôt que de lever une exception, afin que l'échec soit
-- bien enregistré dans invitation_attempts (une exception annulerait l'écriture).
-- Statuts : lie | deja_lie | code_invalide | trop_de_tentatives
create or replace function public.redeem_parent_link_code(p_code text)
returns table (status text, link_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  _failures int;
  _inv public.invitations%rowtype;
  _existing uuid;
  _new_id uuid;
begin
  if auth.uid() is null or not public.has_role('parent')
     or not exists (select 1 from public.parents p where p.user_id = auth.uid()) then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;

  select count(*) into _failures from public.invitation_attempts a
  where a.user_id = auth.uid() and not a.succeeded
    and a.attempted_at > now() - interval '1 hour';
  if _failures >= 5 then
    status := 'trop_de_tentatives'; link_id := null; return next; return;
  end if;

  select * into _inv from public.invitations inv
  where inv.code_hash = public.hash_link_code(public.normalize_link_code(p_code))
    and inv.used_at is null and inv.revoked_at is null and inv.expires_at > now()
  for update;

  if not found or _inv.student_id = auth.uid() then
    insert into public.invitation_attempts (user_id, succeeded) values (auth.uid(), false);
    status := 'code_invalide'; link_id := null; return next; return;
  end if;

  update public.invitations set used_at = now(), used_by = auth.uid() where id = _inv.id;
  insert into public.invitation_attempts (user_id, succeeded) values (auth.uid(), true);

  select l.id into _existing from public.parent_student_links l
  where l.parent_id = auth.uid() and l.student_id = _inv.student_id and l.status = 'actif';
  if found then
    status := 'deja_lie'; link_id := _existing; return next; return;
  end if;

  insert into public.parent_student_links (parent_id, student_id, invitation_id)
  values (auth.uid(), _inv.student_id, _inv.id)
  returning id into _new_id;

  perform public.write_audit('liaison.creee', 'parent_student_links', _new_id::text,
    jsonb_build_object('student_id', _inv.student_id));

  status := 'lie'; link_id := _new_id; return next;
end;
$$;

create or replace function public.revoke_parent_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.parent_student_links l
  set status = 'revoque', revoked_at = now(), revoked_by = auth.uid()
  where l.id = p_link_id
    and l.status = 'actif'
    and (l.parent_id = auth.uid() or l.student_id = auth.uid() or public.is_admin());

  if not found then
    raise exception 'lien_introuvable' using errcode = 'P0002';
  end if;

  perform public.write_audit('liaison.revoquee', 'parent_student_links', p_link_id::text, '{}'::jsonb);
end;
$$;

-- Liens familiaux actifs de l'utilisateur courant (vue « mes enfants » / « mes parents »).
create or replace function public.my_family_links()
returns table (
  link_id uuid, relation text, other_user_id uuid, other_display_name text, linked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, 'enfant', l.student_id, p.display_name, l.created_at
  from public.parent_student_links l
  join public.profiles p on p.id = l.student_id
  where l.parent_id = auth.uid() and l.status = 'actif' and public.has_role('parent')
  union all
  select l.id, 'parent', l.parent_id, p.display_name, l.created_at
  from public.parent_student_links l
  join public.profiles p on p.id = l.parent_id
  where l.student_id = auth.uid() and l.status = 'actif'
  order by 5 desc;
$$;

-- -----------------------------------------------------------------------------
-- Privilèges : on retire tout puis on accorde le strict nécessaire.
-- (Supabase accorde par défaut ALL à anon et authenticated sur le schéma public.)
-- -----------------------------------------------------------------------------

revoke all on public.profiles, public.user_roles, public.students, public.parents,
  public.teachers, public.invitations, public.parent_student_links,
  public.invitation_attempts, public.audit_logs
from anon, authenticated;

grant select on public.profiles, public.user_roles, public.students, public.parents,
  public.teachers, public.parent_student_links, public.audit_logs
to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (grade_level_id, series_id, school_year_id) on public.students to authenticated;
-- Le hachage des codes n'est jamais lisible par les clients.
grant select (id, kind, student_id, expires_at, used_at, revoked_at, created_at)
  on public.invitations to authenticated;

-- Fonctions : par défaut Supabase accorde EXECUTE à anon ; on restreint.
revoke execute on function
  public.has_role(public.app_role), public.is_admin(), public.is_staff_pedagogique(),
  public.is_parent_of(uuid), public.is_child_of(uuid),
  public.write_audit(text, text, text, jsonb), public.handle_new_user(),
  public.admin_grant_role(uuid, public.app_role), public.admin_revoke_role(uuid, public.app_role),
  public.admin_list_users(text, int, int),
  public.normalize_link_code(text), public.hash_link_code(text),
  public.create_parent_link_code(), public.redeem_parent_link_code(text),
  public.revoke_parent_link(uuid), public.my_family_links()
from public, anon, authenticated;

grant execute on function
  public.has_role(public.app_role), public.is_admin(), public.is_staff_pedagogique(),
  public.is_parent_of(uuid), public.is_child_of(uuid),
  public.admin_grant_role(uuid, public.app_role), public.admin_revoke_role(uuid, public.app_role),
  public.admin_list_users(text, int, int),
  public.create_parent_link_code(), public.redeem_parent_link_code(text),
  public.revoke_parent_link(uuid), public.my_family_links()
to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.user_roles           enable row level security;
alter table public.students             enable row level security;
alter table public.parents              enable row level security;
alter table public.teachers             enable row level security;
alter table public.invitations          enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.invitation_attempts  enable row level security;
alter table public.audit_logs           enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.is_parent_of(id)
    or public.is_child_of(id)
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- user_roles : lecture de ses propres rôles ; aucune écriture directe.
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- students
create policy students_select on public.students for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_staff_pedagogique()
    or public.is_parent_of(user_id)
  );
create policy students_update_self on public.students for update to authenticated
  using (user_id = auth.uid() and public.has_role('eleve'))
  with check (user_id = auth.uid());

-- parents
create policy parents_select on public.parents for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_child_of(user_id));

-- teachers
create policy teachers_select on public.teachers for select to authenticated
  using (user_id = auth.uid() or public.is_staff_pedagogique());

-- invitations : l'élève voit l'historique de ses codes (sans le hachage).
create policy invitations_select_own on public.invitations for select to authenticated
  using (student_id = auth.uid());

-- parent_student_links
create policy links_select on public.parent_student_links for select to authenticated
  using (parent_id = auth.uid() or student_id = auth.uid() or public.is_admin());

-- invitation_attempts : aucune politique => aucun accès client.

-- audit_logs : lecture réservée aux administrateurs.
create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using (public.is_admin());
