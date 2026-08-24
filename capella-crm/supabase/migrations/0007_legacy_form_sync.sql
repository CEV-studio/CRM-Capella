-- Migration 0007 — import historique + synchronisation Google Form

alter table public.prospects
  add column if not exists legacy_ref text,
  add column if not exists legacy_sheet text,
  add column if not exists legacy_stage text,
  add column if not exists legacy_payload jsonb not null default '{}'::jsonb;

create unique index if not exists idx_prospects_legacy_ref
  on public.prospects(legacy_sheet, legacy_ref)
  where legacy_ref is not null;

alter table public.affaires
  add column if not exists legacy_ref text,
  add column if not exists legacy_payload jsonb not null default '{}'::jsonb;

create unique index if not exists idx_affaires_legacy_ref
  on public.affaires(legacy_ref)
  where legacy_ref is not null;

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  source_name text not null,
  mode text not null check (mode in ('dry-run','apply')),
  status text not null default 'started' check (status in ('started','completed','failed')),
  stats jsonb not null default '{}'::jsonb,
  error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.import_runs enable row level security;
drop policy if exists import_runs_manage on public.import_runs;
create policy import_runs_manage on public.import_runs
  for all to authenticated using (public.can_manage()) with check (public.can_manage());

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  submitted_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  affaire_id uuid references public.affaires(id) on delete set null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique(source, external_id)
);

alter table public.form_submissions enable row level security;
drop policy if exists form_submissions_manage on public.form_submissions;
create policy form_submissions_manage on public.form_submissions
  for all to authenticated using (public.can_manage()) with check (public.can_manage());

create index if not exists idx_form_submissions_affaire on public.form_submissions(affaire_id);
