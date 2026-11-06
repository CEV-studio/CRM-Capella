alter table public.be_contracts drop constraint be_contracts_centre_check;
alter table public.be_contracts drop constraint be_contracts_sarah_agent_check;
alter table public.be_invoices drop constraint be_invoices_centre_check;
alter table public.be_contracts add constraint be_contracts_centre_check check(centre in ('TILIRA','Cimsourse','SG Contact')) not valid;
alter table public.be_invoices add constraint be_invoices_centre_check check(centre in ('TILIRA','Cimsourse','SG Contact')) not valid;
update public.be_contracts set centre='SG Contact',data=data||jsonb_build_object('centre','SG Contact') where centre='Sarah';
update public.be_access set centre='SG Contact' where centre='Sarah';
update public.be_sale_entries set centre='SG Contact' where centre='Sarah';
update public.be_client_comments set centre='SG Contact' where centre='Sarah';
update public.be_comment_history set centre='SG Contact' where centre='Sarah';
update public.be_sales_agents set centre='SG Contact' where centre='Sarah';
-- No Sarah invoice has been issued; never mutate a frozen invoice snapshot.
do $check$ begin if exists(select 1 from public.be_invoices where centre='Sarah') then raise exception 'Existing Sarah invoice requires explicit reconciliation'; end if; end $check$;
alter table public.be_contracts validate constraint be_contracts_centre_check;
alter table public.be_invoices validate constraint be_invoices_centre_check;
alter table public.be_contracts add constraint be_contracts_sg_contact_agent_check check(lower(regexp_replace(agent,'[^a-zA-Z]','','g'))<>'ayoubelguebais' or centre='SG Contact');
CREATE OR REPLACE FUNCTION public.be_import(p_kind text, p_source text, p_date date, p_fingerprint text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare batch uuid; r jsonb; old public.be_contracts; k text; n integer:=0; changed integer:=0; same integer:=0; begin
 if not public.is_admin() then raise exception 'Accès administrateur requis'; end if;
 if p_kind not in ('report','migration','statement') or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>10000 then raise exception 'Import vide ou invalide'; end if;
 -- Serialize imports to prevent concurrent duplicates or stale previews.
 perform pg_advisory_xact_lock(620261020);
 if exists(select 1 from public.be_imports where fingerprint=p_fingerprint) then raise exception 'Ce fichier a déjà été importé'; end if;
 insert into public.be_imports(kind,source,report_date,fingerprint,row_count,created_by) values(p_kind,p_source,p_date,p_fingerprint,jsonb_array_length(p_rows),auth.uid()) returning id into batch;
 for r in select value from jsonb_array_elements(p_rows) loop
 if lower(regexp_replace(coalesce(r->>'agent',''),'[^a-zA-Z]','','g'))='ayoubelguebais' then
 r:=r||jsonb_build_object('centre','SG Contact');
 end if;
 k:=r->>'key';
 if k is null or length(k)>100 or coalesce(r->>'supplier','MEGA')<>'MEGA' then raise exception 'Clé ou fournisseur invalide'; end if;
 select * into old from public.be_contracts where key=k for update;
 if old.key is null then
 select * into old from public.be_contracts where mega_id=split_part(k,':',2) and ean=split_part(k,':',3) and upper(case when energy='Gaz' then 'GAZ' else 'ELEC' end)=split_part(k,':',4) for update;
 end if;
 if old.key is null and p_kind<>'statement' then
 select * into old from public.be_contracts where mega_id=r->>'mega_id' and ean is null and (data->>'energy')=r->>'energy' for update;
 end if;
 if old.key is not null then k:=old.key; r:=r||jsonb_build_object('key',k); end if;
 if p_kind='statement' then
 if old.key is null then raise exception 'Contrat inconnu : %',k; end if;
 if (r->>'period')::date is null or (r->>'gross_cents') is null or (r->>'centre_cents') is null then raise exception 'Période ou montant absent'; end if;
 insert into public.be_statement_lines(supplier,period,contract_key,gross_cents,centre_cents,data,import_id)
 values('MEGA',(r->>'period')::date,k,(r->>'gross_cents')::integer,(r->>'centre_cents')::integer,r,batch);
 n:=n+1;
 else
 if old.key is not null and old.report_date>p_date then raise exception 'Reporting antérieur pour % : mise à jour refusée',k; end if;
 if old.key is not null and (old.mega_id<>r->>'mega_id' or (old.ean is not null and old.ean<>r->>'ean')) then raise exception 'Identité différente pour %',k; end if;
 if old.key is not null then
 -- Daily reports never erase the first observed activation or historical period.
 r:=r || jsonb_build_object('effect_date',coalesce(old.data->>'effect_date',r->>'effect_date'),'period',coalesce(old.data->>'period',r->>'period'),'clawback_end',coalesce(old.data->>'clawback_end',r->>'clawback_end'));
 end if;
 -- Provisional production: registration month through M+1 day 14 inclusive.
 if not exists(select 1 from public.be_statement_lines where contract_key=k) and coalesce((r->>'period_confirmed')::boolean,false)=false then
 r:=r||jsonb_build_object('period',case when nullif(r->>'effect_date','') is null then null
when nullif(r->>'registered_date','') is not null
and (r->>'effect_date')::date >= date_trunc('month',(r->>'registered_date')::date)::date
and (r->>'effect_date')::date <= (date_trunc('month',(r->>'registered_date')::date)+interval '1 month 13 days')::date
then date_trunc('month',(r->>'registered_date')::date)::date
else date_trunc('month',(r->>'effect_date')::date)::date end);
 end if;
 insert into public.be_contracts(key,supplier,mega_id,ean,energy,agent,centre,status,status_class,report_date,data,import_id)
 values(k,'MEGA',r->>'mega_id',nullif(r->>'ean',''),r->>'energy',r->>'agent',r->>'centre',r->>'status',r->>'status_class',p_date,r,batch)
 on conflict(key) do update set ean=excluded.ean,agent=excluded.agent,centre=excluded.centre,status=excluded.status,status_class=excluded.status_class,report_date=excluded.report_date,data=excluded.data,import_id=excluded.import_id;
 if old.key is null then n:=n+1; elsif (old.data - 'report_date') is distinct from (r - 'report_date') then changed:=changed+1; else same:=same+1; end if;
 if old.key is null or (old.data - 'report_date') is distinct from (r - 'report_date') then
 insert into public.be_contract_history(contract_key,import_id,before_data,after_data) values(k,batch,old.data,r);
 end if;
 end if;
 end loop;
 return jsonb_build_object('id',batch,'added',n,'changed',changed,'unchanged',same);
end $function$
;
