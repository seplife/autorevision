-- =============================================================================
-- Migration 0006 — Demandes de rôle à l'inscription (personnel pédagogique)
--
-- À l'inscription, un utilisateur peut DEMANDER le rôle « enseignant » ou
-- « responsable_pedagogique ». Il ne reçoit AUCUN droit : la demande doit être
-- approuvée par un administrateur. Le rôle « administrateur » ne peut jamais
-- être demandé : il reste attribué par un autre administrateur.
-- =============================================================================

create type public.role_request_status as enum ('en_attente', 'approuvee', 'refusee');

create table public.role_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  requested_role  public.app_role not null
    check (requested_role in ('enseignant', 'responsable_pedagogique')),
  status          public.role_request_status not null default 'en_attente',
  decided_by      uuid references public.profiles (id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  check ((status = 'en_attente') = (decided_at is null))
);
create unique index role_requests_one_pending
  on public.role_requests (user_id) where status = 'en_attente';
create index role_requests_status_idx on public.role_requests (status, created_at);

-- Aucune écriture directe ; chacun lit uniquement ses propres demandes.
revoke all on public.role_requests from anon, authenticated;
grant select on public.role_requests to authenticated;
alter table public.role_requests enable row level security;
create policy role_requests_select on public.role_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Inscription : eleve / parent donnent un rôle ; enseignant / responsable
-- créent seulement une demande. Toute autre valeur (dont « administrateur »)
-- est ignorée.
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

  _type := new.raw_user_meta_data ->> 'account_type';
  if _type = 'eleve' then
    insert into public.students (user_id) values (new.id);
    insert into public.user_roles (user_id, role) values (new.id, 'eleve');
  elsif _type = 'parent' then
    insert into public.parents (user_id) values (new.id);
    insert into public.user_roles (user_id, role) values (new.id, 'parent');
  elsif _type in ('enseignant', 'responsable_pedagogique') then
    insert into public.role_requests (user_id, requested_role)
    values (new.id, _type::public.app_role);
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Administration : liste et décision
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_role_requests()
returns table (
  id uuid, user_id uuid, display_name text, email text,
  requested_role public.app_role, created_at timestamptz
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
    select r.id, r.user_id, p.display_name, u.email::text, r.requested_role, r.created_at
    from public.role_requests r
    join public.profiles p on p.id = r.user_id
    join auth.users u on u.id = r.user_id
    where r.status = 'en_attente'
    order by r.created_at;
end;
$$;

create or replace function public.admin_decide_role_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.role_requests;
begin
  if not public.is_admin() then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  select * into v_req from public.role_requests
   where id = p_request_id and status = 'en_attente' for update;
  if not found then
    raise exception 'demande_introuvable' using errcode = 'P0002';
  end if;
  if v_req.user_id = auth.uid() then
    raise exception 'auto_modification_interdite' using errcode = '42501';
  end if;

  if p_approve then
    perform public.admin_grant_role(v_req.user_id, v_req.requested_role);
  end if;

  update public.role_requests
     set status = case when p_approve then 'approuvee'::public.role_request_status
                       else 'refusee'::public.role_request_status end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_request_id;

  perform public.write_audit(
    case when p_approve then 'demande_role.approuvee' else 'demande_role.refusee' end,
    'role_requests', p_request_id::text,
    jsonb_build_object('role', v_req.requested_role, 'user_id', v_req.user_id));
end;
$$;

create or replace function public.request_my_role(p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'acces_refuse' using errcode = '42501';
  end if;
  if p_role not in ('enseignant', 'responsable_pedagogique') then
    raise exception 'role_non_autorise' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_roles where user_id = v_uid and role = p_role) then
    return;
  end if;
  insert into public.role_requests (user_id, requested_role)
  values (v_uid, p_role)
  on conflict (user_id) where status = 'en_attente'
  do update set requested_role = excluded.requested_role, created_at = now();
end;
$$;

revoke execute on function
  public.request_my_role(public.app_role),
  public.admin_list_role_requests(),
  public.admin_decide_role_request(uuid, boolean)
from public, anon, authenticated;
grant execute on function
  public.request_my_role(public.app_role),
  public.admin_list_role_requests(),
  public.admin_decide_role_request(uuid, boolean)
to authenticated;
