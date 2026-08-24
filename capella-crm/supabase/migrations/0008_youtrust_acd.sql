-- Migration 0008 — suivi des ACD envoyées via Youtrust

alter table public.prospects
  add column if not exists acd_youtrust_request_id text,
  add column if not exists acd_sent_at timestamptz,
  add column if not exists acd_status text,
  add column if not exists acd_error text;

create index if not exists idx_prospects_acd_status
  on public.prospects(acd_status)
  where acd_status is not null;
