begin;
-- Enforce the restrictions already applied by the commercial server forms,
-- including when callers bypass Next.js and use the Supabase Data API.
create function private.guard_adv_operational_fields() returns trigger
language plpgsql set search_path='' as $$
begin
 -- Backend imports and authenticated active ADV/admin operations retain access.
 if auth.uid() is null or private.can_process_adv() then return new; end if;
 if tg_table_name='affaires' then
  if tg_op='INSERT' then
   if coalesce(new.commission,0)<>0 or new.date_signature is not null or new.stage='Signé' then
    raise exception 'Validation et commission réservées au traitement ADV' using errcode='42501';
   end if;
  elsif new.commission is distinct from old.commission or new.date_signature is distinct from old.date_signature
    or (new.stage is distinct from old.stage and (old.stage='Signé' or new.stage='Signé')) then
   raise exception 'Validation et commission réservées au traitement ADV' using errcode='42501';
  end if;
 elsif tg_table_name='acd_requests' then
  if tg_op='INSERT' then
   if new.status<>'a_traiter' or new.processed_by is not null or new.processed_at is not null then
    raise exception 'Traitement ACD réservé à ADV' using errcode='42501';
   end if;
  elsif new.status is distinct from old.status or new.processed_by is distinct from old.processed_by or new.processed_at is distinct from old.processed_at then
   raise exception 'Traitement ACD réservé à ADV' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_adv_operational_fields() from public,anon,authenticated;
create trigger adv_operational_fields before insert or update on public.affaires for each row execute function private.guard_adv_operational_fields();
create trigger adv_operational_fields before insert or update on public.acd_requests for each row execute function private.guard_adv_operational_fields();
commit;
