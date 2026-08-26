-- CAPELLA CRM — isolation Gmail par utilisateur + boites partagees

alter table public.email_accounts
  add column if not exists owner_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists is_shared boolean not null default false;

update public.email_accounts
set owner_profile_id = created_by
where owner_profile_id is null and created_by is not null;

create table if not exists public.email_account_members (
  email_account_id uuid not null references public.email_accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  can_read boolean not null default true,
  can_send boolean not null default true,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (email_account_id, profile_id)
);

create index if not exists idx_email_accounts_owner_active
  on public.email_accounts(owner_profile_id, is_active, connected_at desc);
create index if not exists idx_email_account_members_profile
  on public.email_account_members(profile_id, is_default desc);

alter table public.email_account_members enable row level security;

drop policy if exists email_account_members_read on public.email_account_members;
create policy email_account_members_read on public.email_account_members
  for select to authenticated
  using ((select public.is_admin()) or profile_id = (select auth.uid()));

drop policy if exists email_account_members_manage on public.email_account_members;
create policy email_account_members_manage on public.email_account_members
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists email_accounts_admin on public.email_accounts;
drop policy if exists email_accounts_read on public.email_accounts;
create policy email_accounts_read on public.email_accounts
  for select to authenticated
  using (
    (select public.is_admin())
    or owner_profile_id = (select auth.uid())
    or exists (
      select 1 from public.email_account_members m
      where m.email_account_id = id
        and m.profile_id = (select auth.uid())
    )
  );

drop policy if exists email_accounts_manage on public.email_accounts;
create policy email_accounts_manage on public.email_accounts
  for all to authenticated
  using ((select public.is_admin()) or owner_profile_id = (select auth.uid()))
  with check ((select public.is_admin()) or owner_profile_id = (select auth.uid()));

create or replace function public.can_access_email_account(p_account uuid, p_send boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.email_accounts ea
    where ea.id = p_account
      and (
        ea.owner_profile_id = auth.uid()
        or exists (
          select 1
          from public.email_account_members m
          where m.email_account_id = ea.id
            and m.profile_id = auth.uid()
            and m.can_read = true
            and (not p_send or m.can_send = true)
        )
      )
      and (not p_send or ea.is_active = true)
  );
$$;

revoke all on function public.can_access_email_account(uuid, boolean) from public, anon;
grant execute on function public.can_access_email_account(uuid, boolean) to authenticated;

drop policy if exists email_messages_read on public.email_messages;
create policy email_messages_read on public.email_messages
  for select to authenticated
  using (
    (select public.is_admin())
    or (
      public.can_access_email_account(email_account_id, false)
      and (
        (select public.can_view_all())
        or exists (
          select 1 from public.prospects p
          where p.id = prospect_id
            and p.deleted_at is null
            and p.assigned_to = (select auth.uid())
        )
      )
    )
  );

drop policy if exists email_messages_insert on public.email_messages;
create policy email_messages_insert on public.email_messages
  for insert to authenticated
  with check (
    (select public.is_admin())
    or (
      public.can_access_email_account(email_account_id, true)
      and (
        (select public.can_view_all())
        or exists (
          select 1 from public.prospects p
          where p.id = prospect_id
            and p.deleted_at is null
            and p.assigned_to = (select auth.uid())
        )
      )
    )
  );
