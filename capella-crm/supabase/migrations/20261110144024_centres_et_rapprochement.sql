create table public.be_centres (id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 100), created_at timestamptz not null default now());
create unique index be_centres_name_unique on public.be_centres (lower(trim(name)));
insert into public.be_centres(name) select distinct on (lower(trim(centre))) trim(centre) from (select centre from public.be_contracts union all select centre from public.be_access union all select centre from public.be_sales_agents) c where nullif(trim(centre),'') is not null order by lower(trim(centre)),trim(centre);
alter table public.be_centres enable row level security;
grant select,insert on public.be_centres to authenticated;
create policy admin_read_centres on public.be_centres for select to authenticated using ((select public.is_admin()));
create policy admin_insert_centres on public.be_centres for insert to authenticated with check ((select public.is_admin()));

create or replace function private.be_normalize_name(value text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(translate(lower(trim(coalesce(value,''))), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'), '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function private.be_production_read_scoped(p_include_history boolean, p_history_client text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; reader_role text;
begin
 select role into reader_role from public.profiles where id=auth.uid() and is_active;
 if auth.uid() is null or reader_role is null or reader_role not in ('admin','qualite','be_centre','be_agent') then raise exception 'Accès production refusé' using errcode='42501';end if;
 with visible as (
 select c.* from public.be_contracts c where reader_role in ('admin','qualite') or exists(
 select 1 from public.be_access a where a.user_id=auth.uid() and a.is_active and a.centre=c.centre and
 ((reader_role='be_centre' and a.agent_ref is null) or (reader_role='be_agent' and a.agent_ref is not null and lower(trim(a.agent_ref))=lower(trim(c.agent)))))
 ) select jsonb_build_object(
 'contracts',coalesce((select jsonb_agg(jsonb_build_object(
 'key',c.key,'supplier',c.supplier,'mega_id',c.mega_id,'ean',c.ean,'energy',c.energy,'agent',c.agent,'agent_reference',coalesce(c.data->>'agent_reference',c.agent),'centre',c.centre,'status',c.status,'status_class',c.status_class,'report_date',c.report_date,
 'reference',c.data->'reference','client',c.data->'client','phone',c.data->'phone','postal_code',c.data->'postal_code','product',c.data->'product','registered_date',c.data->'registered_date','effect_date',c.data->'effect_date','period',c.data->'period','period_confirmed',exists(select 1 from public.be_statement_lines s where s.contract_key=c.key),'clawback_end',c.data->'clawback_end') order by c.key) from visible c),'[]'::jsonb),
 'tracking',coalesce((select jsonb_agg(jsonb_build_object('contract_key',t.contract_key,'effect_date',t.effect_date,'termination_date',t.termination_date)) from public.be_cycle_tracking t join visible c on c.key=t.contract_key),'[]'::jsonb),
 'history',case when p_include_history then coalesce((select jsonb_agg(jsonb_build_object('contract_key',h.contract_key,'date',h.created_at,'before_status',h.before_data->>'status','status',h.after_data->>'status','agent',h.after_data->>'agent') order by h.created_at desc) from public.be_contract_history h join visible c on c.key=h.contract_key),'[]'::jsonb) else '[]'::jsonb end,
 'last_report',(select max(report_date) from visible)) into result;
 with visible_entries as (
 select s.* from public.be_sale_entries s where reader_role in ('admin','qualite') or exists(
 select 1 from public.be_access a where a.user_id=auth.uid() and a.is_active and a.centre=s.centre and
 ((reader_role='be_centre' and a.agent_ref is null) or (reader_role='be_agent' and a.agent_ref is not null and s.owner_id=auth.uid())))
 ), candidates as (
 select s.*,p.kind as product_kind,p.supplier as product_supplier,p.label as product_label,(select min(c.key) from public.be_contracts c where p.supplier='MEGA' and p.kind='energy'
 and private.be_normalize_name(coalesce(c.data->>'client','')) in (private.be_normalize_name(s.last_name||' '||s.first_name),private.be_normalize_name(s.first_name||' '||s.last_name))
 and c.energy=s.energy and c.centre=s.centre and lower(trim(c.agent))=lower(trim(s.agent_ref))
 and (s.mega_id is null or c.mega_id is null or s.mega_id=c.mega_id)
 and (s.ean='' or c.ean is null or s.ean=c.ean)
 and (s.contract_reference='' or nullif(c.data->>'reference','') is null or s.contract_reference=c.data->>'reference')
 and (length(regexp_replace(coalesce(s.phone,''),'[^0-9]','','g'))<9 or length(regexp_replace(coalesce(c.data->>'phone',''),'[^0-9]','','g'))<9 or right(regexp_replace(s.phone,'[^0-9]','','g'),9)=right(regexp_replace(c.data->>'phone','[^0-9]','','g'),9))
 having count(*)=1) as match_key from visible_entries s join public.be_products p on p.id=s.product_id
 ), matched as (
 select candidates.*,case when match_key is not null and count(*) over(partition by match_key)>1 then null else match_key end as unique_match_key from candidates
 ), displayed as (
 select c.value || coalesce((select jsonb_build_object('client_id',coalesce(s.mega_id,'CRM:'||s.id::text),'product_kind',s.product_kind,'product_family',s.product_label,'owner_id',s.owner_id,'owner_name',s.owner_name,'entry_id',s.id,'encoded_at',s.created_at,'email',s.email,'phone',s.phone) from matched s where s.unique_match_key=c.value->>'key'),'{}'::jsonb) as item from jsonb_array_elements(result->'contracts') c
 union all
 select jsonb_build_object('key','SAISIE:'||s.id,'supplier',s.product_supplier,'mega_id',coalesce(s.mega_id,''),'ean',s.ean,'energy',s.energy,'agent',s.agent_ref,'agent_reference',s.agent_ref,'centre',s.centre,'status','Signé','status_class','Signé','report_date',(s.created_at at time zone 'Europe/Paris')::date,'reference',s.contract_reference,'client',s.last_name||' '||s.first_name,'phone',s.phone,'email',s.email,'product',s.product,'registered_date',(s.created_at at time zone 'Europe/Paris')::date,'effect_date',null,'period',null,'period_confirmed',false,'clawback_end',null,'client_id',coalesce(s.mega_id,'CRM:'||s.id::text),'product_kind',s.product_kind,'product_family',s.product_label,'owner_id',s.owner_id,'owner_name',s.owner_name,'entry_id',s.id,'encoded_at',s.created_at,'reconciliation',case when exists(select 1 from public.be_contracts c where s.product_supplier='MEGA' and s.product_kind='energy' and c.energy=s.energy and (private.be_normalize_name(coalesce(c.data->>'client','')) in (private.be_normalize_name(s.last_name||' '||s.first_name),private.be_normalize_name(s.first_name||' '||s.last_name)) or s.mega_id is not null and s.mega_id=c.mega_id or s.ean<>'' and s.ean=c.ean or s.contract_reference<>'' and s.contract_reference=c.data->>'reference')) then 'À vérifier' else 'En attente MEGA' end) from matched s where s.unique_match_key is null
 ) select jsonb_set(result,'{contracts}',coalesce((select jsonb_agg(item order by item->>'key') from displayed),'[]'::jsonb)) into result;
 -- Agent responses must contain only entries created by this authenticated agent,
 -- including all associated status history and tracking rows.
 if reader_role='be_agent' then
  result:=jsonb_set(result,'{contracts}',coalesce((select jsonb_agg(v) from jsonb_array_elements(result->'contracts') v where v->>'owner_id'=auth.uid()::text),'[]'::jsonb));
  result:=jsonb_set(result,'{tracking}',coalesce((select jsonb_agg(t) from jsonb_array_elements(result->'tracking') t where exists(select 1 from jsonb_array_elements(result->'contracts') c where c->>'key'=t->>'contract_key')),'[]'::jsonb));
  result:=jsonb_set(result,'{history}',coalesce((select jsonb_agg(h) from jsonb_array_elements(result->'history') h where exists(select 1 from jsonb_array_elements(result->'contracts') c where c->>'key'=h->>'contract_key')),'[]'::jsonb));
  result:=jsonb_set(result,'{last_report}',coalesce((select to_jsonb(max(c->>'report_date')) from jsonb_array_elements(result->'contracts') c),'null'::jsonb));
 end if;
 -- Load status history only for the requested visible client, after ownership filtering.
 if not p_include_history and nullif(p_history_client,'') is not null then
  result:=jsonb_set(result,'{history}',coalesce((select jsonb_agg(jsonb_build_object('contract_key',h.contract_key,'date',h.created_at,'before_status',h.before_data->>'status','status',h.after_data->>'status','agent',h.after_data->>'agent') order by h.created_at desc) from public.be_contract_history h join jsonb_array_elements(result->'contracts') c on c->>'key'=h.contract_key where coalesce(nullif(c->>'client_id',''),nullif(c->>'mega_id',''),c->>'key')=p_history_client),'[]'::jsonb));
 end if;
 return result||jsonb_build_object('encoding',case when reader_role='be_agent' then (select jsonb_build_object('centre',centre,'agent_ref',agent_ref) from public.be_access where user_id=auth.uid() and is_active and agent_ref is not null) else null end);
end $$;

