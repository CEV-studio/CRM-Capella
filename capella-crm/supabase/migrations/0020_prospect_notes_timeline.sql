-- Journal horodaté des notes commerciales par prospect/client.
create table if not exists public.prospect_notes (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_prospect_notes_prospect_created
  on public.prospect_notes(prospect_id, created_at desc);

alter table public.prospect_notes enable row level security;
revoke all on table public.prospect_notes from anon;
grant select, insert on table public.prospect_notes to authenticated;

create policy prospect_notes_admin_all on public.prospect_notes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy prospect_notes_select_own on public.prospect_notes
  for select to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1 from public.prospects p
      where p.id = prospect_notes.prospect_id
        and p.assigned_to = auth.uid()
        and p.deleted_at is null
    )
  );

create policy prospect_notes_insert_own on public.prospect_notes
  for insert to authenticated
  with check (
    public.is_active_user()
    and author_id = auth.uid()
    and exists (
      select 1 from public.prospects p
      where p.id = prospect_notes.prospect_id
        and p.assigned_to = auth.uid()
        and p.deleted_at is null
    )
  );

-- Conversion des anciens mémos uniques en première note historique.
insert into public.prospect_notes (prospect_id, author_id, author_name, body, created_at)
select
  p.id,
  pr.id,
  coalesce(pr.full_name, 'Note historique'),
  p.notes,
  coalesce(p.updated_at, p.created_at, now())
from public.prospects p
left join public.profiles pr on pr.id = coalesce(p.assigned_to, p.created_by)
where nullif(trim(p.notes), '') is not null
  and not exists (select 1 from public.prospect_notes n where n.prospect_id = p.id);
