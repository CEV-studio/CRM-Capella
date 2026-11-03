alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','commercial','manager','apporteur','qualite','be_centre','be_agent'));
alter table public.profiles add column manager_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add constraint profiles_manager_id_check check (manager_id is null or (role = 'commercial' and manager_id <> id));
alter table public.profiles add constraint manager_private check (role <> 'manager' or (not can_export and not can_view_all and not can_manage_team));
create index idx_profiles_manager_id on public.profiles(manager_id) where manager_id is not null;

create or replace function public.tg_protect_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.manager_id := old.manager_id;
  if public.can_manage() then return new; end if;
  new.role := old.role;
  new.commission_rate := old.commission_rate;
  new.is_active := old.is_active;
  new.can_export := old.can_export;
  new.can_view_all := old.can_view_all;
  new.can_manage_team := old.can_manage_team;
  return new;
end;
$$;
