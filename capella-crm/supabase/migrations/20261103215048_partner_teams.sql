create table public.partner_teams (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 partner_name text check (partner_name is null or length(trim(partner_name)) between 1 and 120),
 manager_id uuid references public.profiles(id) on delete set null,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create unique index partner_teams_unique_name on public.partner_teams (lower(trim(name)));
create index partner_teams_manager on public.partner_teams(manager_id) where manager_id is not null;
alter table public.partner_teams enable row level security;
revoke all on public.partner_teams from public, anon;
grant select, insert, update, delete on public.partner_teams to authenticated;
grant all on public.partner_teams to service_role;
create policy partner_teams_admin on public.partner_teams for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.profiles add column partner_team_id uuid references public.partner_teams(id) on delete set null;
alter table public.profiles add constraint profiles_partner_team_commercial check (partner_team_id is null or role='commercial');
create index profiles_partner_team_id on public.profiles(partner_team_id) where partner_team_id is not null;

create or replace function public.tg_protect_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.manager_id := old.manager_id;
  new.partner_team_id := old.partner_team_id;
  new.archived_at := old.archived_at;
  if public.can_manage() then return new; end if;
  new.role := old.role;
  new.commission_rate := old.commission_rate;
  new.is_active := old.is_active;
  new.can_export := old.can_export;
  new.can_view_all := old.can_view_all;
  new.can_manage_team := old.can_manage_team;
  return new;
end;
$$;

create or replace function public.partner_team_stats()
returns table(team_id uuid, membres bigint, prospects_actifs bigint, dossiers_en_cours bigint, dossiers_valides bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
 if not coalesce((select public.is_admin()),false) then raise exception 'Accès réservé' using errcode='42501'; end if;
 return query
 with members as (
  select p.id,p.partner_team_id from public.profiles p where p.role='commercial' and p.archived_at is null and p.partner_team_id is not null
 ), counts as (
  select m.partner_team_id, count(*) as n from members m group by m.partner_team_id
 ), prospects as (
  select m.partner_team_id, count(*) as n from members m join public.prospects p on p.assigned_to=m.id
  where p.deleted_at is null and p.stage not in ('KO','Numéro KO','Pas intéressé','DDF trop éloignée') group by m.partner_team_id
 ), affaires as (
  select m.partner_team_id, count(*) filter(where a.stage not in ('Signé','KO')) as encours,
   count(*) filter(where a.stage='Signé') as valides from members m join public.affaires a on a.commercial_id=m.id
  where a.deleted_at is null group by m.partner_team_id
 )
 select t.id,coalesce(c.n,0),coalesce(p.n,0),coalesce(a.encours,0),coalesce(a.valides,0)
 from public.partner_teams t left join counts c on c.partner_team_id=t.id left join prospects p on p.partner_team_id=t.id left join affaires a on a.partner_team_id=t.id;
end;
$$;
revoke all on function public.partner_team_stats() from public, anon;
grant execute on function public.partner_team_stats() to authenticated;
