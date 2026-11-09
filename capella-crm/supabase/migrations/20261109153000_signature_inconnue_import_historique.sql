create or replace function public.tg_affaire_rules() returns trigger language plpgsql set search_path=public,pg_temp as $function$
begin
 if new.ref is null then new.ref := 'CAP-' || lpad(nextval('public.affaire_ref_seq')::text,6,'0'); end if;
 if new.stage='Signé' and new.date_signature is null and coalesce(new.legacy_payload->>'date_signature_inconnue','false')<>'true' then new.date_signature:=current_date; end if;
 return new;
end;
$function$;