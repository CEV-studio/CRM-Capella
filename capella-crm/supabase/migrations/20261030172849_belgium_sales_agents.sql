-- Commercial identity is independent of a CRM login. Historical MEGA references
-- are registered once; unknown or missing references remain visible for review.
create table public.be_sales_agents (
 id uuid primary key default gen_random_uuid(),
 centre text not null check (length(trim(centre)) between 1 and 100),
 agent_ref text not null check (agent_ref=lower(trim(agent_ref)) and length(agent_ref) between 2 and 80),
 display_name text not null check (length(trim(display_name)) between 1 and 120),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique (centre,agent_ref)
);

insert into public.be_sales_agents (centre,agent_ref,display_name)
select distinct c.centre,lower(trim(c.agent)),lower(trim(c.agent))
from public.be_contracts c
where length(trim(c.agent)) between 2 and 80
  and lower(trim(c.agent)) not in ('non renseigné','non renseigne','inconnu','n/a')
  and c.agent ~ '^[a-zA-Z0-9._-]+$'
on conflict (centre,agent_ref) do nothing;

insert into public.be_sales_agents (centre,agent_ref,display_name)
select a.centre,lower(trim(a.agent_ref)),p.full_name
from public.be_access a join public.profiles p on p.id=a.user_id
where a.agent_ref is not null
on conflict (centre,agent_ref) do update set display_name=excluded.display_name;

alter table public.be_sales_agents enable row level security;
revoke all on public.be_sales_agents from anon;
grant select,insert,update on public.be_sales_agents to authenticated;
create policy admin_read on public.be_sales_agents for select to authenticated
 using ((select public.is_admin()));
create policy admin_insert on public.be_sales_agents for insert to authenticated
 with check ((select public.is_admin()));
create policy admin_update on public.be_sales_agents for update to authenticated
 using ((select public.is_admin())) with check ((select public.is_admin()));
