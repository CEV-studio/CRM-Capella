-- Allow apporteurs to submit validated ACD requests through the partner command only.
-- Direct edits and direct inserts remain blocked by the restrictive policies.

drop policy if exists acd_partner_no_insert on public.acd_requests;
create policy acd_partner_no_insert on public.acd_requests
as restrictive for insert to authenticated
with check (
  public.current_role_name() <> 'apporteur'
  or coalesce(current_setting('app.partner_acd_submit', true), '') = 'on'
);

drop policy if exists acd_meters_partner_no_insert on public.acd_request_meters;
create policy acd_meters_partner_no_insert on public.acd_request_meters
as restrictive for insert to authenticated
with check (
  public.current_role_name() <> 'apporteur'
  or coalesce(current_setting('app.partner_acd_submit', true), '') = 'on'
);

create or replace function public.partner_command(
  p_action text,
  p_id uuid,
  p_data jsonb default '{}'
) returns uuid
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_action = 'submit' then
    perform set_config('app.partner_acd_submit', 'on', true);
  end if;
  return private.partner_command(p_action, p_id, p_data);
end;
$$;

revoke all on function public.partner_command(text,uuid,jsonb) from public, anon;
grant execute on function public.partner_command(text,uuid,jsonb) to authenticated;

-- ACD notifications for admins must open the ADV queue, while other partner
-- notifications keep opening the partner dossier.
create or replace function private.partner_notify(
  p_dossier uuid,
  p_title text,
  p_body text,
  p_admin boolean
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Non autorisé';
  end if;

  insert into public.crm_notifications(recipient_id,actor_id,dossier_id,title,body,href,email_to)
  select
    p.id,
    auth.uid(),
    d.id,
    p_title,
    p_body,
    case
      when p_admin and p_title in ('Nouvelle demande d’ACD', 'Renvoi d’ACD demandé')
        then '/admin/acd'
      else '/partenaires/dossiers/' || d.id
    end,
    case when p_admin then 'jeremy@capellaenergy.fr' else p.email end
  from public.partner_dossiers d
  join public.profiles p
    on ((p_admin and p.role='admin') or (not p_admin and p.id=d.owner_id))
  where d.id=p_dossier and p.is_active;
end;
$$;
