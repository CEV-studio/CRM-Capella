create or replace function public.storage_pj_autorise(nom text)
returns boolean
language sql
stable
security definer
set search_path=public,storage
as $$
  select case split_part($1, '/', 1)
    when 'prospects' then
      public.can_view_all()
      or exists (
        select 1 from public.prospects p
        where p.id = nullif(split_part($1, '/', 2), '')::uuid
          and p.assigned_to = (select auth.uid())
      )
    when 'affaires' then
      public.can_view_all()
      or exists (
        select 1 from public.affaires a
        where a.id = nullif(split_part($1, '/', 2), '')::uuid
          and a.commercial_id = (select auth.uid())
      )
    else false
  end;
$$;
