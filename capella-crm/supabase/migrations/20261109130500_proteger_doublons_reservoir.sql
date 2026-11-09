create or replace view public.reservoir_disponible with (security_invoker = true) as
select p.* from public.prospects p
where p.deleted_at is null and p.assigned_to is null and p.became_client_at is null and p.entered_conversion_at is null
and not exists (select 1 from public.affaires a where a.prospect_id=p.id and a.deleted_at is null and a.stage='Signé')
and not exists (
 select 1 from public.prospects other where other.id<>p.id and other.deleted_at is null and
 (other.assigned_to is not null or other.became_client_at is not null or other.entered_conversion_at is not null or exists(select 1 from public.affaires a where a.prospect_id=other.id and a.stage='Signé' and a.deleted_at is null))
 and ((length(p.siren_norm)=14 and p.siren_norm=other.siren_norm) or (length(p.pdl_norm)=14 and p.pdl_norm=other.pdl_norm) or (length(p.pce_norm)=14 and p.pce_norm=other.pce_norm))
)
and not exists (select 1 from public.affaires a where a.deleted_at is null and a.stage='Signé' and ((length(p.pdl_norm)=14 and p.pdl_norm=a.pdl_elec) or (length(p.pce_norm)=14 and p.pce_norm=a.pce_gaz) or (length(p.siren_norm)=14 and p.siren_norm=a.siren)));
create or replace function public.proteger_attribution_prospect() returns trigger language plpgsql security definer set search_path=public,pg_temp as $f$
begin
 if new.assigned_to is distinct from old.assigned_to then
   if old.assigned_to is not null then raise exception 'Cette fiche est déjà attribuée et ne peut pas être réattribuée.'; end if;
   if new.assigned_to is not null and not exists(select 1 from public.reservoir_disponible where id=old.id) then
    raise exception 'Cette fiche ou un dossier correspondant appartient déjà à un portefeuille et ne peut pas être distribué.';
   end if;
 end if;
 return new;
end $f$;