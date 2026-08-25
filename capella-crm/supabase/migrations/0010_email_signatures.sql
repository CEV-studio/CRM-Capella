-- CAPELLA CRM — signatures email CRM

create table if not exists public.email_signatures (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  name text not null default 'Signature',
  html text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists email_signatures_profile_unique
  on public.email_signatures (coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_email_signatures_profile
  on public.email_signatures(profile_id)
  where is_active = true;

alter table public.email_signatures enable row level security;

drop policy if exists email_signatures_admin on public.email_signatures;
create policy email_signatures_admin on public.email_signatures
  for all to authenticated
  using (public.can_manage())
  with check (public.can_manage());

create or replace function public.tg_email_signatures_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_email_signatures_updated_at on public.email_signatures;
create trigger trg_email_signatures_updated_at
  before update on public.email_signatures
  for each row execute function public.tg_email_signatures_updated_at();
