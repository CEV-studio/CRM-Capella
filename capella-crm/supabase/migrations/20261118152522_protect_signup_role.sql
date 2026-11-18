-- Signup metadata is controlled by the caller and must never grant roles.
create or replace function public.tg_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role, commission_rate, must_change_password)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email, 'commercial', coalesce((new.raw_user_meta_data->>'commission_rate')::numeric, 0.50),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Self-service profile updates must not change roles or other permissions.
create or replace function public.guard_profile_self_permissions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.id and not coalesce(public.is_admin(), false)
    and (to_jsonb(new) - array['full_name','must_change_password','updated_at'])
       is distinct from (to_jsonb(old) - array['full_name','must_change_password','updated_at']) then
    raise exception 'Modification des autorisations interdite' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_self_permissions on public.profiles;
create trigger guard_profile_self_permissions before update on public.profiles
for each row execute function public.guard_profile_self_permissions();
