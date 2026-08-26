-- CAPELLA CRM — Google Calendar par utilisateur

create table if not exists public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  email text not null,
  refresh_token_enc text not null,
  scope text not null,
  is_active boolean not null default true,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Les jetons OAuth ne sont jamais lus directement avec le client utilisateur.
-- Ils sont manipulés uniquement côté serveur via le service role.
alter table public.calendar_accounts enable row level security;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  google_event_id text not null,
  google_calendar_id text not null default 'primary',
  kind text not null default 'rdv' check (kind in ('rdv','rappel')),
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reminder_minutes integer,
  invite_client boolean not null default false,
  html_link text,
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, google_event_id)
);

alter table public.calendar_events enable row level security;

create index if not exists idx_calendar_events_profile_start
  on public.calendar_events(profile_id, start_at);
create index if not exists idx_calendar_events_prospect_start
  on public.calendar_events(prospect_id, start_at);

create policy calendar_events_select_own on public.calendar_events
  for select to authenticated
  using (profile_id = (select auth.uid()));

create policy calendar_events_insert_own on public.calendar_events
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.prospects p
      where p.id = calendar_events.prospect_id
        and p.deleted_at is null
        and (
          p.assigned_to = (select auth.uid())
          or (select public.can_view_all())
        )
    )
  );

create policy calendar_events_update_own on public.calendar_events
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy calendar_events_delete_own on public.calendar_events
  for delete to authenticated
  using (profile_id = (select auth.uid()));

create or replace function public.tg_calendar_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_calendar_accounts_updated_at on public.calendar_accounts;
create trigger trg_calendar_accounts_updated_at
  before update on public.calendar_accounts
  for each row execute function public.tg_calendar_updated_at();

drop trigger if exists trg_calendar_events_updated_at on public.calendar_events;
create trigger trg_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.tg_calendar_updated_at();
