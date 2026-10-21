create or replace function private.partner_acd_sync()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare did uuid;
begin
  if new.status is distinct from old.status
     and new.status in ('a_traiter','en_cours','envoyee','terminee','annulee') then
    update public.partner_dossiers
    set acd_status = case
      when new.status = 'envoyee' then 'envoyee'
      when new.status = 'terminee' then 'signee'
      when new.status = 'annulee' then 'annulee'
      else 'en_preparation'
    end
    where acd_request_id = new.id
    returning id into did;

    if did is not null and new.status = 'terminee' then
      perform private.partner_notify(did,'ACD signée','Vous pouvez maintenant demander une cotation.',false);
    end if;
  end if;
  return new;
end;
$$;
