create or replace view public.reservoir_disponible with (security_invoker = true) as
select p.* from public.prospects p
where p.deleted_at is null and p.assigned_to is null and p.became_client_at is null and p.entered_conversion_at is null
and not exists (select 1 from public.affaires a where a.prospect_id=p.id and a.deleted_at is null and a.stage='Signé');
grant select on public.reservoir_disponible to authenticated, service_role;
create or replace function public.proteger_attribution_prospect() returns trigger language plpgsql security definer set search_path=public,pg_temp as $f$
begin
 if new.assigned_to is distinct from old.assigned_to then
   if old.assigned_to is not null then
     raise exception 'Cette fiche est déjà attribuée et ne peut pas être réattribuée.';
   end if;
   if new.assigned_to is not null and (old.deleted_at is not null or old.became_client_at is not null or old.entered_conversion_at is not null or exists (select 1 from public.affaires a where a.prospect_id=old.id and a.deleted_at is null and a.stage='Signé')) then
     raise exception 'Cette fiche appartient déjà au portefeuille client et ne peut pas être distribuée.';
   end if;
 end if;
 return new;
end $f$;
drop trigger if exists proteger_attribution_prospect on public.prospects;
create trigger proteger_attribution_prospect before update of assigned_to on public.prospects for each row execute function public.proteger_attribution_prospect();