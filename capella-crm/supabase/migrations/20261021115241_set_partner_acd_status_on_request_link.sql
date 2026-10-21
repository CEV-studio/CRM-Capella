create or replace function private.partner_dossier_acd_link_status()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare request_status text;
begin
  if new.acd_request_id is not null
     and new.acd_request_id is distinct from old.acd_request_id then
    select status into request_status
    from public.acd_requests
    where id = new.acd_request_id;

    new.acd_status := case
      when request_status = 'envoyee' then 'envoyee'
      when request_status = 'terminee' then 'signee'
      when request_status = 'annulee' then 'annulee'
      else 'en_preparation'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists partner_dossier_acd_link_status on public.partner_dossiers;
create trigger partner_dossier_acd_link_status
before update of acd_request_id on public.partner_dossiers
for each row execute function private.partner_dossier_acd_link_status();
