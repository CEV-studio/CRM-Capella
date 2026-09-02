create table if not exists public.acd_requests (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete restrict,
  requested_by uuid references public.profiles(id) on delete set null,
  processed_by uuid references public.profiles(id) on delete set null,
  status text not null default 'a_traiter' check (status in ('a_traiter', 'en_cours', 'terminee', 'annulee')),
  raison_sociale text not null,
  siren text not null check (siren ~ '^[0-9]{9}$'),
  siret text not null check (siret ~ '^[0-9]{14}$'),
  signatory_first_name text not null,
  signatory_last_name text not null,
  signatory_email text not null,
  signatory_phone text not null,
  signatory_capacity text not null check (signatory_capacity in ('representant_legal', 'mandataire')),
  signatory_role text not null,
  notes text,
  submitted_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acd_request_meters (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.acd_requests(id) on delete cascade,
  position integer not null default 0,
  energy_type text not null check (energy_type in ('electricite', 'gaz')),
  identifier text not null check (identifier ~ '^[0-9]{14}$'),
  contract_expiry date not null,
  address text,
  postal_code text,
  city text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_acd_requests_one_active on public.acd_requests(prospect_id) where status in ('a_traiter', 'en_cours');
create index if not exists idx_acd_requests_queue on public.acd_requests(status, submitted_at desc);
create index if not exists idx_acd_request_meters_request on public.acd_request_meters(request_id, position);

alter table public.acd_requests enable row level security;
alter table public.acd_request_meters enable row level security;

create policy acd_requests_select on public.acd_requests for select to authenticated using (
  (select public.can_manage()) or requested_by = (select auth.uid()) or exists (select 1 from public.prospects p where p.id = acd_requests.prospect_id and p.assigned_to = (select auth.uid()) and p.deleted_at is null)
);
create policy acd_requests_insert on public.acd_requests for insert to authenticated with check (
  requested_by = (select auth.uid()) and ((select public.can_manage()) or exists (select 1 from public.prospects p where p.id = acd_requests.prospect_id and p.assigned_to = (select auth.uid()) and p.deleted_at is null))
);
create policy acd_requests_manage on public.acd_requests for update to authenticated using ((select public.can_manage())) with check ((select public.can_manage()));

create policy acd_request_meters_select on public.acd_request_meters for select to authenticated using (
  exists (select 1 from public.acd_requests r where r.id = acd_request_meters.request_id and ((select public.can_manage()) or r.requested_by = (select auth.uid()) or exists (select 1 from public.prospects p where p.id = r.prospect_id and p.assigned_to = (select auth.uid()) and p.deleted_at is null)))
);
create policy acd_request_meters_insert on public.acd_request_meters for insert to authenticated with check (
  exists (select 1 from public.acd_requests r join public.prospects p on p.id = r.prospect_id where r.id = acd_request_meters.request_id and r.requested_by = (select auth.uid()) and ((select public.can_manage()) or (p.assigned_to = (select auth.uid()) and p.deleted_at is null)))
);
create or replace function public.tg_acd_request_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at = now(); return new; end $$;
create trigger trg_acd_requests_updated_at before update on public.acd_requests for each row execute function public.tg_acd_request_updated_at();
