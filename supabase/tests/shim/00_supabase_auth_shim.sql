-- =============================================================================
-- Émulation minimale de Supabase pour les tests SANS Docker.
-- NE PAS appliquer sur un vrai projet Supabase (ces objets y existent déjà).
--
-- Reproduit :
--   * les rôles anon / authenticated / service_role ;
--   * le schéma auth avec auth.users et auth.uid() (lecture des claims JWT
--     exactement comme PostgREST les expose : request.jwt.claims) ;
--   * les privilèges par défaut de Supabase sur le schéma public
--     (ALL accordé à anon et authenticated), afin que les tests détectent
--     toute table ou fonction que les migrations oublieraient de restreindre.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists auth;
create schema if not exists extensions;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               varchar(255) unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );
$$;

grant usage on schema auth, extensions, public to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
grant all on all tables in schema auth to service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
