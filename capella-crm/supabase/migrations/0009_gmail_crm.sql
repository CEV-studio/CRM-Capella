-- CAPELLA CRM — Gmail / templates / historique emails

create table if not exists public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  refresh_token_enc text not null,
  scope text not null,
  is_active boolean not null default true,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null default '',
  body text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  email_account_id uuid references public.email_accounts(id) on delete set null,
  gmail_message_id text not null unique,
  gmail_thread_id text,
  header_message_id text,
  direction text not null check (direction in ('incoming','outgoing')),
  from_email text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text,
  body_text text,
  body_html text,
  snippet text,
  sent_at timestamptz,
  template_id uuid references public.email_templates(id) on delete set null,
  triggered_by uuid references public.profiles(id) on delete set null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_messages_prospect on public.email_messages(prospect_id, sent_at desc);
create index if not exists idx_email_messages_thread on public.email_messages(gmail_thread_id);
create index if not exists idx_email_templates_active on public.email_templates(is_active, sort_order);

alter table public.email_accounts enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_messages enable row level security;

drop policy if exists email_accounts_admin on public.email_accounts;
create policy email_accounts_admin on public.email_accounts
  for all to authenticated
  using (public.can_manage())
  with check (public.can_manage());

drop policy if exists email_templates_read on public.email_templates;
create policy email_templates_read on public.email_templates
  for select to authenticated
  using ((public.is_active_user() and is_active = true) or public.can_manage());

drop policy if exists email_templates_manage on public.email_templates;
create policy email_templates_manage on public.email_templates
  for all to authenticated
  using (public.can_manage())
  with check (public.can_manage());

drop policy if exists email_messages_read on public.email_messages;
create policy email_messages_read on public.email_messages
  for select to authenticated
  using (
    public.can_view_all()
    or exists (
      select 1 from public.prospects p
      where p.id = prospect_id
        and p.deleted_at is null
        and p.assigned_to = auth.uid()
    )
  );

drop policy if exists email_messages_insert on public.email_messages;
create policy email_messages_insert on public.email_messages
  for insert to authenticated
  with check (
    public.can_view_all()
    or exists (
      select 1 from public.prospects p
      where p.id = prospect_id
        and p.deleted_at is null
        and p.assigned_to = auth.uid()
    )
  );

create or replace function public.tg_email_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_email_accounts_updated_at on public.email_accounts;
create trigger trg_email_accounts_updated_at
  before update on public.email_accounts
  for each row execute function public.tg_email_updated_at();

drop trigger if exists trg_email_templates_updated_at on public.email_templates;
create trigger trg_email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.tg_email_updated_at();
