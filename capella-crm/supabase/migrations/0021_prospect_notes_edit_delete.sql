alter table public.prospect_notes
  add column if not exists updated_at timestamptz;

grant update, delete on table public.prospect_notes to authenticated;

drop policy if exists prospect_notes_update_own on public.prospect_notes;
create policy prospect_notes_update_own on public.prospect_notes
  for update to authenticated
  using (
    public.is_active_user()
    and author_id = auth.uid()
    and exists (
      select 1 from public.prospects p
      where p.id = prospect_notes.prospect_id
        and p.assigned_to = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.prospects p
      where p.id = prospect_notes.prospect_id
        and p.assigned_to = auth.uid()
        and p.deleted_at is null
    )
  );

drop policy if exists prospect_notes_delete_own on public.prospect_notes;
create policy prospect_notes_delete_own on public.prospect_notes
  for delete to authenticated
  using (
    public.is_active_user()
    and author_id = auth.uid()
    and exists (
      select 1 from public.prospects p
      where p.id = prospect_notes.prospect_id
        and p.assigned_to = auth.uid()
        and p.deleted_at is null
    )
  );