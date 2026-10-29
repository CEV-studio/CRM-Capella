create or replace function private.be_client_access(p_id text,p_centre text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and (
 p.role in ('admin','qualite') or p.role in ('be_centre','be_agent') and exists(
 select 1 from public.be_access a where a.user_id=p.id and a.is_active and a.centre=p_centre and (
 p.role='be_centre' and a.agent_ref is null or p.role='be_agent' and a.agent_ref is not null and (
 exists(select 1 from public.be_sale_entries s where coalesce(s.mega_id,'CRM:'||s.id::text)=p_id and s.centre=a.centre and s.owner_id=p.id)))))
 );
$$;

create or replace function private.be_production_read() returns jsonb
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
 'history',coalesce((select jsonb_agg(jsonb_build_object('contract_key',h.contract_key,'date',h.created_at,'before_status',h.before_data->>'status','status',h.after_data->>'status','agent',h.after_data->>'agent') order by h.created_at desc) from public.be_contract_history h join visible c on c.key=h.contract_key),'[]'::jsonb),
 'last_report',(select max(report_date) from visible)) into result;
 with visible_entries as (
 select s.* from public.be_sale_entries s where reader_role in ('admin','qualite') or exists(
 select 1 from public.be_access a where a.user_id=auth.uid() and a.is_active and a.centre=s.centre and
 ((reader_role='be_centre' and a.agent_ref is null) or (reader_role='be_agent' and a.agent_ref is not null and s.owner_id=auth.uid())))
 ), candidates as (
 select s.*,p.kind as product_kind,p.supplier as product_supplier,p.label as product_label,(select min(c.key) from public.be_contracts c where p.supplier='MEGA' and p.kind='energy' and (s.mega_id is not null and c.mega_id=s.mega_id or s.mega_id is null and (s.ean<>'' and c.ean=s.ean or s.contract_reference<>'' and c.data->>'reference'=s.contract_reference or (
       s.ean='' and s.contract_reference='' and length(regexp_replace(coalesce(c.data->>'phone',''),'[^0-9]','','g'))>=9
       and length(regexp_replace(s.phone,'[^0-9]','','g'))>=9
       and right(regexp_replace(c.data->>'phone','[^0-9]','','g'),9)=right(regexp_replace(s.phone,'[^0-9]','','g'),9)
       and lower(regexp_replace(trim(coalesce(c.data->>'client','')), '[[:space:]]+', ' ', 'g')) in (
         lower(regexp_replace(trim(s.last_name||' '||s.first_name), '[[:space:]]+', ' ', 'g')),
         lower(regexp_replace(trim(s.first_name||' '||s.last_name), '[[:space:]]+', ' ', 'g')))))) and c.energy=s.energy and c.centre=s.centre and lower(trim(c.agent))=lower(trim(s.agent_ref)) and (s.ean='' or s.ean=c.ean) having count(*)=1) as match_key from visible_entries s join public.be_products p on p.id=s.product_id
 ), matched as (
 select candidates.*,case when match_key is not null and count(*) over(partition by match_key)>1 then null else match_key end as unique_match_key from candidates
 ), displayed as (
 select c.value || coalesce((select jsonb_build_object('client_id',coalesce(s.mega_id,'CRM:'||s.id::text),'product_kind',s.product_kind,'product_family',s.product_label,'owner_id',s.owner_id,'owner_name',s.owner_name,'entry_id',s.id,'encoded_at',s.created_at,'email',s.email,'phone',s.phone) from matched s where s.unique_match_key=c.value->>'key'),'{}'::jsonb) as item from jsonb_array_elements(result->'contracts') c
 union all
 select jsonb_build_object('key','SAISIE:'||s.id,'supplier',s.product_supplier,'mega_id',coalesce(s.mega_id,''),'ean',s.ean,'energy',s.energy,'agent',s.agent_ref,'agent_reference',s.agent_ref,'centre',s.centre,'status','Signé','status_class','Signé','report_date',(s.created_at at time zone 'Europe/Paris')::date,'reference',s.contract_reference,'client',s.last_name||' '||s.first_name,'phone',s.phone,'email',s.email,'product',s.product,'registered_date',(s.created_at at time zone 'Europe/Paris')::date,'effect_date',null,'period',null,'period_confirmed',false,'clawback_end',null,'client_id',coalesce(s.mega_id,'CRM:'||s.id::text),'product_kind',s.product_kind,'product_family',s.product_label,'owner_id',s.owner_id,'owner_name',s.owner_name,'entry_id',s.id,'encoded_at',s.created_at,'reconciliation',case when exists(select 1 from public.be_contracts c where s.product_supplier='MEGA' and s.product_kind='energy' and (s.mega_id is not null and c.mega_id=s.mega_id or s.mega_id is null and (s.ean<>'' and c.ean=s.ean or s.contract_reference<>'' and c.data->>'reference'=s.contract_reference or (
       s.ean='' and s.contract_reference='' and length(regexp_replace(coalesce(c.data->>'phone',''),'[^0-9]','','g'))>=9
       and length(regexp_replace(s.phone,'[^0-9]','','g'))>=9
       and right(regexp_replace(c.data->>'phone','[^0-9]','','g'),9)=right(regexp_replace(s.phone,'[^0-9]','','g'),9)
       and lower(regexp_replace(trim(coalesce(c.data->>'client','')), '[[:space:]]+', ' ', 'g')) in (
         lower(regexp_replace(trim(s.last_name||' '||s.first_name), '[[:space:]]+', ' ', 'g')),
         lower(regexp_replace(trim(s.first_name||' '||s.last_name), '[[:space:]]+', ' ', 'g')))))) and c.energy=s.energy) then 'À vérifier' else 'En attente MEGA' end) from matched s where s.unique_match_key is null
 ) select jsonb_set(result,'{contracts}',coalesce((select jsonb_agg(item order by item->>'key') from displayed),'[]'::jsonb)) into result;
 -- Agent responses must contain only entries created by this authenticated agent,
 -- including all associated status history and tracking rows.
 if reader_role='be_agent' then
  result:=jsonb_set(result,'{contracts}',coalesce((select jsonb_agg(v) from jsonb_array_elements(result->'contracts') v where v->>'owner_id'=auth.uid()::text),'[]'::jsonb));
  result:=jsonb_set(result,'{tracking}',coalesce((select jsonb_agg(t) from jsonb_array_elements(result->'tracking') t where exists(select 1 from jsonb_array_elements(result->'contracts') c where c->>'key'=t->>'contract_key')),'[]'::jsonb));
  result:=jsonb_set(result,'{history}',coalesce((select jsonb_agg(h) from jsonb_array_elements(result->'history') h where exists(select 1 from jsonb_array_elements(result->'contracts') c where c->>'key'=h->>'contract_key')),'[]'::jsonb));
  result:=jsonb_set(result,'{last_report}',coalesce((select to_jsonb(max(c->>'report_date')) from jsonb_array_elements(result->'contracts') c),'null'::jsonb));
 end if;
 return result||jsonb_build_object('encoding',case when reader_role='be_agent' then (select jsonb_build_object('centre',centre,'agent_ref',agent_ref) from public.be_access where user_id=auth.uid() and is_active and agent_ref is not null) else null end);
end $$;
