alter table public.profiles add column hierarchy_title text;
alter table public.profiles add constraint profiles_hierarchy_title_check
  check (hierarchy_title is null or (hierarchy_title = 'Leader' and role = 'manager'));

create or replace function public.tg_protect_profile_privileges()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
 if auth.uid() is null or public.is_admin() then return new; end if;
 new.manager_id := old.manager_id;
 new.partner_team_id := old.partner_team_id;
 new.archived_at := old.archived_at;
 new.hierarchy_title := old.hierarchy_title;
 if public.can_manage() then return new; end if;
 new.role := old.role;
 new.commission_rate := old.commission_rate;
 new.is_active := old.is_active;
 new.can_export := old.can_export;
 new.can_view_all := old.can_view_all;
 new.can_manage_team := old.can_manage_team;
 return new;
end; $$;
