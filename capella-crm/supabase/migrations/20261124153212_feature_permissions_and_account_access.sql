begin;
alter table public.profiles add column permissions text[] not null default '{}';
-- Snapshot existing entitlements once. No account receives an additional module.
update public.profiles set permissions=(case role
 when 'admin' then array['administration','crm','apporteur','adv','qualite','equipe','belgique_lecture','belgique_centre','belgique_encodage','email','crm_gestion','crm_lecture_globale','export']
 when 'commercial' then array['crm','email']
 when 'manager' then array['crm','email','equipe']
 when 'apporteur' then array['apporteur']
 when 'adv' then array['adv']
 when 'qualite' then array['qualite','belgique_lecture']
 when 'be_centre' then array['belgique_centre']
 when 'be_agent' then array['belgique_encodage']
 else '{}'::text[] end)
 ||case when can_export then array['export'] else '{}'::text[] end
 ||case when can_view_all then array['crm_lecture_globale'] else '{}'::text[] end
 ||case when can_manage_team then array['crm_gestion'] else '{}'::text[] end;
update public.profiles p set permissions=(select array_agg(distinct x order by x) from unnest(p.permissions) x) where cardinality(permissions)>0;
alter table public.profiles add constraint profiles_permissions_known check(permissions<@array['administration','crm','apporteur','adv','qualite','equipe','belgique_lecture','belgique_centre','belgique_encodage','email','crm_gestion','crm_lecture_globale','export']::text[] and array_position(permissions,null) is null);
create index profiles_permissions_idx on public.profiles using gin(permissions);
-- The obsolete columns remain inert for a compatible deployment. They are never
-- consulted by authorization after this migration and are not exposed in account forms.
do $$ declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.profiles'::regclass and (pg_get_constraintdef(oid)~'\mrole\M' or conname in ('manager_private','quality_private','adv_private')) loop
  execute format('alter table public.profiles drop constraint %I',c.conname);
 end loop;
end $$;
-- Capability-based implementations of the existing business commands.
CREATE OR REPLACE FUNCTION private.be_production_read_scoped(p_include_history boolean, p_history_client text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; reader_permissions text[];
begin
 select permissions into reader_permissions from public.profiles where id=auth.uid() and is_active;
 if auth.uid() is null or reader_permissions is null or not (reader_permissions && array['administration','qualite','belgique_lecture','belgique_centre','belgique_encodage']::text[]) then raise exception 'Accès production refusé' using errcode='42501';end if;
 with visible as (
 select c.* from public.be_contracts c where (reader_permissions && array['administration','qualite','belgique_lecture']::text[]) or exists(
 select 1 from public.be_access a where a.user_id=auth.uid() and a.is_active and a.centre=c.centre and
 (((reader_permissions && array['belgique_centre']::text[]) and a.agent_ref is null) or ((reader_permissions && array['belgique_encodage']::text[]) and a.agent_ref is not null and lower(trim(a.agent_ref))=lower(trim(c.agent)))))
 ) select jsonb_build_object(
 'contracts',coalesce((select jsonb_agg(jsonb_build_object(
 'key',c.key,'supplier',c.supplier,'mega_id',c.mega_id,'ean',c.ean,'energy',c.energy,'agent',c.agent,'agent_reference',coalesce(c.data->>'agent_reference',c.agent),'centre',c.centre,'status',c.status,'status_class',c.status_class,'report_date',c.report_date,
 'reference',c.data->'reference','client',c.data->'client','phone',c.data->'phone','postal_code',c.data->'postal_code','product',c.data->'product','registered_date',c.data->'registered_date','effect_date',c.data->'effect_date','period',c.data->'period','period_confirmed',exists(select 1 from public.be_statement_lines s where s.contract_key=c.key),'clawback_end',c.data->'clawback_end') order by c.key) from visible c),'[]'::jsonb),
 'tracking',coalesce((select jsonb_agg(jsonb_build_object('contract_key',t.contract_key,'effect_date',t.effect_date,'termination_date',t.termination_date)) from public.be_cycle_tracking t join visible c on c.key=t.contract_key),'[]'::jsonb),
 'history',case when p_include_history then coalesce((select jsonb_agg(jsonb_build_object('contract_key',h.contract_key,'date',h.created_at,'before_status',h.before_data->>'status','status',h.after_data->>'status','agent',h.after_data->>'agent') order by h.created_at desc) from public.be_contract_history h join visible c on c.key=h.contract_key),'[]'::jsonb) else '[]'::jsonb end,
 'last_report',(select max(report_date) from visible)) into result;
 with visible_entries as (
 select s.* from public.be_sale_entries s where (reader_permissions && array['administration','qualite','belgique_lecture']::text[]) or exists(
 select 1 from public.be_access a where a.user_id=auth.uid() and a.is_active and a.centre=s.centre and
 (((reader_permissions && array['belgique_centre']::text[]) and a.agent_ref is null) or ((reader_permissions && array['belgique_encodage']::text[]) and a.agent_ref is not null and s.owner_id=auth.uid())))
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
 if (reader_permissions && array['belgique_encodage']::text[]) and not (reader_permissions && array['administration','qualite','belgique_lecture','belgique_centre']::text[]) then
  result:=jsonb_set(result,'{contracts}',coalesce((select jsonb_agg(v) from jsonb_array_elements(result->'contracts') v where v->>'owner_id'=auth.uid()::text),'[]'::jsonb));
  result:=jsonb_set(result,'{tracking}',coalesce((select jsonb_agg(t) from jsonb_array_elements(result->'tracking') t where exists(select 1 from jsonb_array_elements(result->'contracts') c where c->>'key'=t->>'contract_key')),'[]'::jsonb));
  result:=jsonb_set(result,'{history}',coalesce((select jsonb_agg(h) from jsonb_array_elements(result->'history') h where exists(select 1 from jsonb_array_elements(result->'contracts') c where c->>'key'=h->>'contract_key')),'[]'::jsonb));
  result:=jsonb_set(result,'{last_report}',coalesce((select to_jsonb(max(c->>'report_date')) from jsonb_array_elements(result->'contracts') c),'null'::jsonb));
 end if;
 -- Load status history only for the requested visible client, after ownership filtering.
 if not p_include_history and nullif(p_history_client,'') is not null then
  result:=jsonb_set(result,'{history}',coalesce((select jsonb_agg(jsonb_build_object('contract_key',h.contract_key,'date',h.created_at,'before_status',h.before_data->>'status','status',h.after_data->>'status','agent',h.after_data->>'agent') order by h.created_at desc) from public.be_contract_history h join jsonb_array_elements(result->'contracts') c on c->>'key'=h.contract_key where coalesce(nullif(c->>'client_id',''),nullif(c->>'mega_id',''),c->>'key')=p_history_client),'[]'::jsonb));
 end if;
 return result||jsonb_build_object('encoding',case when (reader_permissions && array['belgique_encodage']::text[]) then (select jsonb_build_object('centre',centre,'agent_ref',agent_ref) from public.be_access where user_id=auth.uid() and is_active and agent_ref is not null) else null end);
end $function$
;

CREATE OR REPLACE FUNCTION private.quality_incident_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 insert into public.crm_notifications(recipient_id,actor_id,title,body,href,email_to,email_status)
 select p.id,new.reporter_id,'Signalement qualité · '||new.title,
  left(new.reporter_name||' · '||new.description,300),
  '/qualite/signalements/'||new.id,p.email,'none'
 from public.profiles p
 where p.is_active and ((p.permissions && array['administration']::text[]) or p.id=any(new.mentioned_ids))
 and p.id is distinct from new.reporter_id;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.partner_command(p_action text, p_id uuid, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare me public.profiles; d public.partner_dossiers; q public.partner_quotes; payload jsonb; m jsonb;
 pid uuid; rid uuid; aid uuid; result_id uuid; first_pdl text; first_pce text; expiry date;
begin
 select * into me from public.profiles where id=auth.uid() and is_active;
 if me.id is null or not (me.permissions && array['administration','adv','apporteur']::text[]) then raise exception 'Accès refusé'; end if;
 if not (me.permissions && array['administration','apporteur']::text[]) and p_action not in ('read','quote','documents','message') then raise exception 'Action ADV refusée' using errcode='42501'; end if;
 if p_action in ('draft','submit','resend') and not ('administration'=any(me.permissions)) and (not ('apporteur'=any(me.permissions)) or exists(select 1 from public.partner_dossiers where id=p_id and owner_id<>me.id)) then raise exception 'Accès au dossier personnel refusé' using errcode='42501'; end if;
 if p_action='read' then
  update public.crm_notifications set read_at=now() where id=p_id and recipient_id=me.id;
  return p_id;
 end if;
 if p_action='draft' then
  if coalesce(p_data->>'siret','') !~ '^[0-9]{14}$' or length(trim(coalesce(p_data->>'raison_sociale','')))=0 then raise exception 'SIRET et raison sociale obligatoires'; end if;
  -- Client generated key makes retries idempotent, including after a lost HTTP response.
  select * into d from public.partner_dossiers where id=p_id;
  if found then
   if d.owner_id<>me.id and not (me.permissions && array['administration','adv']::text[]) then raise exception 'Accès refusé'; end if;
   return d.id;
  end if;
  insert into public.prospects(raison_sociale,siren,assigned_to,created_by) values(p_data->>'raison_sociale',left(p_data->>'siret',9),me.id,me.id) returning id into pid;
  insert into public.partner_dossiers(id,owner_id,prospect_id,company_name,siret,details)
  values(p_id,me.id,pid,p_data->>'raison_sociale',p_data->>'siret',p_data) returning id into result_id;
  return result_id;
 end if;
 select * into d from public.partner_dossiers where id=p_id for update;
 if not found or (d.owner_id<>me.id and not (me.permissions && array['administration','adv']::text[])) then raise exception 'Dossier introuvable'; end if;
 result_id:=d.id;
 if p_action='submit' then
  if d.acd_status<>'brouillon' then return d.id; end if;
  payload:=p_data;
  if exists(select 1 from unnest(array['raison_sociale','siret','company_address','company_postal_code','company_city','signatory_first_name','signatory_last_name','signatory_email','signatory_phone','signatory_role']) k where length(trim(coalesce(payload->>k,'')))=0) then raise exception 'Complétez toutes les informations obligatoires'; end if;
  if payload->>'siret' !~ '^[0-9]{14}$' or payload->>'company_postal_code' !~ '^[0-9]{5}$' or payload->>'signatory_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'SIRET, code postal ou email invalide'; end if;
  if coalesce(payload->>'signatory_capacity','') not in ('representant_legal','mandataire') then raise exception 'Qualité du signataire invalide'; end if;
  if jsonb_typeof(payload->'meters') is distinct from 'array' or jsonb_array_length(payload->'meters')=0 then raise exception 'Ajoutez un compteur'; end if;
  for m in select * from jsonb_array_elements(payload->'meters') loop
   if coalesce(m->>'energy_type','') not in ('electricite','gaz') or coalesce(m->>'identifier','') !~ '^[0-9]{14}$' or coalesce(m->>'contract_expiry','')='' or coalesce(m->>'address','')='' or coalesce(m->>'postal_code','') !~ '^[0-9]{5}$' or coalesce(m->>'city','')='' then raise exception 'Compteur incomplet'; end if;
   perform (m->>'contract_expiry')::date;
  end loop;
  if not exists(select 1 from public.pieces_jointes where prospect_id=d.prospect_id and type='Facture') then raise exception 'Ajoutez au moins une facture'; end if;
  insert into public.acd_requests(prospect_id,requested_by,raison_sociale,siren,siret,company_address,company_postal_code,company_city,signatory_first_name,signatory_last_name,signatory_email,signatory_phone,signatory_capacity,signatory_role,notes)
  values(d.prospect_id,d.owner_id,payload->>'raison_sociale',left(payload->>'siret',9),payload->>'siret',payload->>'company_address',payload->>'company_postal_code',payload->>'company_city',payload->>'signatory_first_name',payload->>'signatory_last_name',payload->>'signatory_email',payload->>'signatory_phone',payload->>'signatory_capacity',payload->>'signatory_role',payload->>'notes') returning id into rid;
  for m in select * from jsonb_array_elements(payload->'meters') loop
   insert into public.acd_request_meters(request_id,energy_type,identifier,contract_expiry,address,postal_code,city) values(rid,m->>'energy_type',m->>'identifier',(m->>'contract_expiry')::date,m->>'address',m->>'postal_code',m->>'city');
   insert into public.prospect_compteurs(prospect_id,entreprise_id,type_energie,numero,siret,date_echeance,adresse,code_postal,ville)
   select d.prospect_id,p.entreprise_id,m->>'energy_type',m->>'identifier',payload->>'siret',(m->>'contract_expiry')::date,m->>'address',m->>'postal_code',m->>'city' from public.prospects p where p.id=d.prospect_id;
  end loop;
  select min(x->>'identifier') filter(where x->>'energy_type'='electricite'), min(x->>'identifier') filter(where x->>'energy_type'='gaz'), min((x->>'contract_expiry')::date) into first_pdl,first_pce,expiry from jsonb_array_elements(payload->'meters') x;
  update public.prospects set raison_sociale=payload->>'raison_sociale',siren=left(payload->>'siret',9),nom=payload->>'signatory_last_name',prenom=payload->>'signatory_first_name',mail=payload->>'signatory_email',tel_mobile=payload->>'signatory_phone',code_postal=payload->>'company_postal_code',pdl=first_pdl,pce=first_pce,date_fin_contrat=expiry,stage='Demande ACD' where id=d.prospect_id;
  update public.entreprises set raison_sociale=payload->>'raison_sociale',siren=left(payload->>'siret',9),adresse=payload->>'company_address',code_postal=payload->>'company_postal_code',ville=payload->>'company_city' where id=(select entreprise_id from public.prospects where id=d.prospect_id);
  update public.partner_dossiers set details=payload,company_name=payload->>'raison_sociale',siret=payload->>'siret',acd_status='envoyee',acd_request_id=rid where id=d.id;
  perform private.partner_notify(d.id,'Nouvelle demande d’ACD',payload->>'raison_sociale',true);
 elsif p_action='resend' then
  if d.acd_status<>'envoyee' then raise exception 'Le renvoi concerne uniquement une ACD en attente de signature'; end if;
  if d.last_resend_at>now()-interval '5 minutes' then raise exception 'Une demande de renvoi vient déjà d’être transmise'; end if;
  update public.partner_dossiers set last_resend_at=now() where id=d.id;
  perform private.partner_notify(d.id,'Renvoi d’ACD demandé',d.company_name,true);
 elsif p_action='quote' then
  if d.acd_status<>'signee' then raise exception 'L’ACD doit être signée avant de demander une cotation'; end if;
  select * into q from public.partner_quotes where request_key=(p_data->>'request_key')::uuid;
  if found then
   if q.dossier_id<>d.id then raise exception 'Référence invalide'; end if;
   return q.id;
  end if;
  if nullif(p_data->>'start_date','') is null or nullif(p_data->>'end_date','') is null or nullif(p_data->>'quote_date','') is null or length(trim(coalesce(p_data->>'comment','')))=0 then raise exception 'Dates et commentaire obligatoires'; end if;
  if (p_data->>'end_date')::date<=(p_data->>'start_date')::date then raise exception 'La fin du contrat doit être après son début'; end if;
  if jsonb_typeof(p_data->'meters') is distinct from 'array' or jsonb_array_length(p_data->'meters')=0 then raise exception 'Ajoutez un PDL/PCE'; end if;
  for m in select * from jsonb_array_elements(p_data->'meters') loop
   if coalesce(m->>'energy_type','') not in ('electricite','gaz') or coalesce(m->>'identifier','') !~ '^[0-9]{14}$' then raise exception 'PDL/PCE invalide'; end if;
  end loop;
  select string_agg(x->>'identifier',', ') filter(where x->>'energy_type'='electricite'),string_agg(x->>'identifier',', ') filter(where x->>'energy_type'='gaz') into first_pdl,first_pce from jsonb_array_elements(p_data->'meters') x;
  insert into public.affaires(commercial_id,prospect_id,raison_sociale,siren,nom,prenom,mail,telephone,type_energie,pdl_elec,pce_gaz,date_debut,date_echeance,notes,created_by)
  values(d.owner_id,d.prospect_id,d.company_name,left(d.siret,9),d.details->>'signatory_last_name',d.details->>'signatory_first_name',d.details->>'signatory_email',d.details->>'signatory_phone',case when first_pdl is not null and first_pce is not null then 'Élec+Gaz' when first_pdl is not null then 'Électricité' else 'Gaz' end,first_pdl,first_pce,(p_data->>'start_date')::date,(p_data->>'end_date')::date,p_data->>'comment',me.id) returning id into aid;
  insert into public.partner_quotes(dossier_id,affaire_id,request_key,start_date,end_date,quote_date,meters,is_regie,offer_market,offer_other,comment)
  values(d.id,aid,(p_data->>'request_key')::uuid,(p_data->>'start_date')::date,(p_data->>'end_date')::date,(p_data->>'quote_date')::date,p_data->'meters',coalesce((p_data->>'is_regie')::boolean,false),coalesce((p_data->>'offer_market')::boolean,false),coalesce((p_data->>'offer_other')::boolean,false),p_data->>'comment') returning id into result_id;
  update public.prospects set stage='Demande de cotation' where id=d.prospect_id;
  perform private.partner_notify(d.id,'Nouvelle demande de cotation',d.company_name||' — cotation souhaitée le '||(p_data->>'quote_date'),true);
 elsif p_action='documents' then
  if not (me.permissions && array['administration','adv']::text[]) then raise exception 'Accès administrateur requis'; end if;
  perform private.partner_notify(d.id,'Documents disponibles',d.company_name||' — consultez les nouveaux documents dans votre dossier.',false);
 elsif p_action='message' then
  if coalesce(p_data->>'kind','message') not in ('message','contrat') then raise exception 'Type de message invalide'; end if;
  if nullif(p_data->>'quote_id','') is not null then
   select * into q from public.partner_quotes where id=(p_data->>'quote_id')::uuid and dossier_id=d.id;
   if not found then raise exception 'Cotation introuvable'; end if;
  elsif p_data->>'kind'='contrat' then raise exception 'Sélectionnez la cotation pour le contrat'; end if;
  insert into public.partner_messages(dossier_id,quote_id,author_id,kind,body) values(d.id,q.id,me.id,coalesce(p_data->>'kind','message'),p_data->>'body');
  perform private.partner_notify(d.id,case when p_data->>'kind'='contrat' then 'Envoi de contrat demandé' else 'Nouveau message' end,d.company_name||' — '||(p_data->>'body'),not (me.permissions && array['administration','adv']::text[]));
 else raise exception 'Action inconnue';
 end if;
 return result_id;
end $function$
;

CREATE OR REPLACE FUNCTION private.partner_notify(p_dossier uuid, p_title text, p_body text, p_admin boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    case when p_admin and (p.permissions && array['administration']::text[]) then 'jeremy@capellaenergy.fr' else p.email end
  from public.partner_dossiers d
  join public.profiles p
    on ((p_admin and (p.permissions && array['administration','adv']::text[])) or (not p_admin and p.id=d.owner_id))
  where d.id=p_dossier and p.is_active;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.transfer_prospect_to_quote(p_prospect_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_prospect public.prospects%rowtype;
  v_affaire_id uuid;
begin
  if auth.uid() is null or not public.is_active_user()
     or not (private.has_permission('administration') or private.has_permission('crm')) then
    raise exception 'Accès refusé';
  end if;

  select p.* into v_prospect
  from public.prospects as p
  where p.id = p_prospect_id and p.deleted_at is null
  for update;

  if not found then
    raise exception 'Prospect introuvable ou inaccessible';
  end if;

  select a.id into v_affaire_id
  from public.affaires as a
  where a.prospect_id = v_prospect.id and a.deleted_at is null
  order by a.created_at desc
  limit 1;

  if v_affaire_id is null then
    insert into public.affaires (
      commercial_id, prospect_id, source_id, raison_sociale, siren,
      nom, prenom, mail, telephone, type_energie, pdl_elec, pce_gaz,
      fournisseur, date_echeance, sans_engagement, notes, stage, created_by
    ) values (
      coalesce(v_prospect.assigned_to, auth.uid()), v_prospect.id,
      v_prospect.source_id,
      coalesce(v_prospect.raison_sociale,
        nullif(concat_ws(' ', v_prospect.prenom, v_prospect.nom), ''),
        '(sans nom)'),
      v_prospect.siren, v_prospect.nom, v_prospect.prenom, v_prospect.mail,
      coalesce(v_prospect.tel_mobile, v_prospect.tel_fixe),
      case
        when v_prospect.pdl is not null and v_prospect.pce is not null then 'Élec+Gaz'
        when v_prospect.pdl is not null then 'Électricité'
        when v_prospect.pce is not null then 'Gaz'
        else null
      end,
      v_prospect.pdl, v_prospect.pce,
      coalesce(v_prospect.fournisseur_electricite, v_prospect.fournisseur_gaz),
      v_prospect.date_fin_contrat, v_prospect.sans_engagement,
      v_prospect.notes, 'Demande de cotation', auth.uid()
    ) returning id into v_affaire_id;
  end if;

  update public.prospects
  set stage = 'Demande de cotation',
      entered_conversion_at = coalesce(entered_conversion_at, now())
  where id = v_prospect.id;

  return v_affaire_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_deadlines_page(p_period text DEFAULT 'toutes'::text, p_query text DEFAULT ''::text, p_page integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_all boolean;
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_year date := (v_today + interval '12 months')::date;
  v_eighteen date := (v_today + interval '18 months')::date;
  v_result jsonb;
begin
  select (permissions && array['administration']::text[]) or ('crm_lecture_globale'=any(permissions)) into v_all from public.profiles
    where id = (select auth.uid()) and is_active and (permissions && array['administration','crm']::text[]);
  if not found then raise exception 'Accès réservé' using errcode = '42501'; end if;
  if p_period is null or p_period not in ('toutes','retard','0_12','12_18','18_plus') then p_period := 'toutes'; end if;

  with visible_prospects as not materialized (
    select p.id, p.ref, p.raison_sociale, p.nom, p.prenom, p.mail, p.tel_mobile,
      p.tel_fixe, p.stage, p.date_fin_contrat, p.fournisseur_electricite, p.fournisseur_gaz
    from public.prospects p
    where p.deleted_at is null and (v_all or p.assigned_to = (select auth.uid()))
  ), deadlines as (
    select 'meter-' || m.id as key, p.id as prospect_id, m.date_echeance as date,
      case when m.type_energie = 'gaz' then 'Gaz'
        else 'Électricité' || case when coalesce(m.segment,'') <> '' then ' · ' || m.segment else '' end end as kind,
      case when m.type_energie = 'gaz' then 'PCE ' else 'PDL ' end || m.numero as identifier,
      case when m.type_energie = 'gaz' then p.fournisseur_gaz else p.fournisseur_electricite end as supplier
    from public.prospect_compteurs m join visible_prospects p on p.id = m.prospect_id
    where m.archived_at is null and m.date_echeance is not null
    union all
    select 'contract-' || p.id, p.id, p.date_fin_contrat, 'Contrat', null,
      nullif(concat_ws(' / ', nullif(p.fournisseur_electricite,''), nullif(p.fournisseur_gaz,'')), '')
    from visible_prospects p
    where p.date_fin_contrat is not null and not exists (
      select 1 from public.prospect_compteurs m where m.prospect_id = p.id
        and m.archived_at is null and m.date_echeance is not null
    )
  ), searchable as materialized (
    select d.*, coalesce(nullif(p.raison_sociale,''), nullif(concat_ws(' ', nullif(p.prenom,''), nullif(p.nom,'')),''), 'Dossier sans nom') as company_name,
      jsonb_build_object('id',p.id,'ref',p.ref,'raison_sociale',p.raison_sociale,'nom',p.nom,'prenom',p.prenom,'stage',p.stage) as prospect,
      case when d.date < v_today then 'retard' when d.date <= v_year then '0_12'
        when d.date <= v_eighteen then '12_18' else '18_plus' end as period
    from deadlines d join visible_prospects p on p.id = d.prospect_id
    where coalesce(btrim(p_query),'') = '' or strpos(lower(concat_ws(' ',
      coalesce(nullif(p.raison_sociale,''),nullif(concat_ws(' ',p.prenom,p.nom),''),'Dossier sans nom'),
      p.prenom,p.nom,p.mail,p.tel_mobile,p.tel_fixe,p.stage,d.identifier,d.supplier)), lower(left(btrim(p_query),120))) > 0
  ), stats as (
    select count(*) as total,
      count(*) filter(where period = 'retard') as overdue,
      count(*) filter(where period = '0_12') as within_year,
      count(*) filter(where period = '12_18') as within_eighteen,
      count(*) filter(where period = '18_plus') as later,
      count(*) filter(where p_period = 'toutes' or period = p_period) as matching
    from searchable
  ), paging as (
    select *, greatest(1,(matching + 49) / 50) as pages,
      least(greatest(1,coalesce(p_page,1)),greatest(1,(matching + 49) / 50)) as page
    from stats
  ), page_rows as (
    select * from searchable where p_period = 'toutes' or period = p_period
    order by date, company_name, key
    limit 50 offset (select (page - 1) * 50 from paging)
  )
  select jsonb_build_object(
    'counts',jsonb_build_object('toutes',total,'retard',overdue,'alerte',within_year + within_eighteen,
      'zeroDouze',within_year,'douzeDixHuit',within_eighteen,'plusTard',later),
    'total',matching,'page',page,'totalPages',pages,'today',v_today,'eighteenMonths',v_eighteen,
    'rows',coalesce((select jsonb_agg(jsonb_build_object('key',key,'prospect',prospect,'date',date,
      'kind',kind,'identifier',identifier,'supplier',supplier) order by date,company_name,key) from page_rows),'[]'::jsonb)
  ) into v_result from paging;
  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_prospect_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_all boolean;
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_result jsonb;
begin
  select (permissions && array['administration']::text[]) or ('crm_lecture_globale'=any(permissions)) into v_all from public.profiles
    where id = (select auth.uid()) and is_active and (permissions && array['administration','crm']::text[]);
  if not found then raise exception 'Accès réservé' using errcode = '42501'; end if;
  with visible as materialized (
    select p.assigned_to, p.stage, p.next_action_date from public.prospects p
    where p.deleted_at is null and (v_all or p.assigned_to = (select auth.uid()))
  ), stages as (
    select stage, count(*) as total from visible group by stage
  ), owners as (
    select assigned_to,
      count(*) filter(where stage not in ('KO','Numéro KO','Pas intéressé','DDF trop éloignée')) as actifs,
      count(*) filter(where next_action_date < v_today and stage not in ('KO','Numéro KO','Pas intéressé','DDF trop éloignée')) as retards
    from visible where assigned_to is not null group by assigned_to
  )
  select jsonb_build_object('stages',coalesce((select jsonb_agg(to_jsonb(stages)) from stages),'[]'::jsonb),
    'owners',coalesce((select jsonb_agg(to_jsonb(owners)) from owners),'[]'::jsonb),
    'upcoming',(select count(*) from visible where next_action_date >= v_today)) into v_result;
  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_reservoir_counts()
 RETURNS TABLE(source_id uuid, total bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.profiles where id = (select auth.uid()) and is_active and (permissions && array['administration']::text[])) then
    raise exception 'Accès réservé' using errcode = '42501';
  end if;
  return query select p.source_id, count(*) from public.prospects p
    where p.assigned_to is null and p.deleted_at is null group by p.source_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.be_client_access(p_id text, p_centre text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and (
 (p.permissions && array['administration','qualite','belgique_lecture']::text[]) or (p.permissions && array['belgique_centre','belgique_encodage']::text[]) and exists(
 select 1 from public.be_access a where a.user_id=p.id and a.is_active and a.centre=p_centre and (
 (p.permissions && array['belgique_centre']::text[]) and a.agent_ref is null or (p.permissions && array['belgique_encodage']::text[]) and a.agent_ref is not null and (
 exists(select 1 from public.be_sale_entries s where coalesce(s.mega_id,'CRM:'||s.id::text)=p_id and s.centre=a.centre and s.owner_id=p.id)))))
 );
$function$
;

CREATE OR REPLACE FUNCTION private.be_entry_access(p_owner uuid, p_centre text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and ((p.permissions && array['administration','qualite','belgique_lecture']::text[]) or exists(
 select 1 from public.be_access a where a.user_id=p.id and a.is_active and a.centre=p_centre and (
 (p.permissions && array['belgique_centre']::text[]) and a.agent_ref is null or (p.permissions && array['belgique_encodage']::text[]) and a.agent_ref is not null and p_owner=p.id))))
$function$
;

CREATE OR REPLACE FUNCTION private.be_save_comment(p_id uuid, p_mega text, p_centre text, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor public.profiles; previous public.be_client_comments; result uuid;
begin
 select * into actor from public.profiles where id=auth.uid() and is_active;
 if actor.id is null or not private.be_client_access(p_mega,p_centre) then raise exception 'Accès client refusé' using errcode='42501';end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 5000 then raise exception 'Commentaire requis (5 000 caractères maximum)';end if;
 if not exists(select 1 from public.be_contracts where mega_id=p_mega and centre=p_centre) and not exists(select 1 from public.be_sale_entries where coalesce(mega_id,'CRM:'||id::text)=p_mega and centre=p_centre) then raise exception 'Client introuvable';end if;
 if p_id is null then
  insert into public.be_client_comments(mega_id,centre,author_id,author_name,body) values(p_mega,p_centre,actor.id,actor.full_name,trim(p_body)) returning id into result;
 else
  select * into previous from public.be_client_comments where id=p_id and mega_id=p_mega and centre=p_centre for update;
  if previous.id is null or (previous.author_id<>actor.id and not (actor.permissions && array['administration']::text[])) then raise exception 'Modification du commentaire refusée' using errcode='42501';end if;
  update public.be_client_comments set body=trim(p_body),updated_at=now() where id=previous.id returning id into result;
 end if;
 insert into public.be_comment_history(comment_id,mega_id,centre,editor_id,editor_name,before_body,after_body) values(result,p_mega,p_centre,actor.id,actor.full_name,previous.body,trim(p_body));
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION private.be_encode_sale(p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor public.profiles; membership public.be_access; result uuid; client_id text; energy_value text; comment_body text; chosen public.be_products;
begin
 select * into actor from public.profiles where id=auth.uid() and is_active and (permissions && array['belgique_encodage']::text[]) and not must_change_password;
 select * into membership from public.be_access where user_id=actor.id and is_active and agent_ref is not null;
 if actor.id is null or membership.user_id is null then raise exception 'Accès encodage refusé' using errcode='42501';end if;
 select * into chosen from public.be_products where is_active and ((nullif(p_data->>'product_id','') is null and code='mega-energie') or id::text=p_data->>'product_id');
 if chosen.id is null then raise exception 'Sélectionne un produit actif';end if;
 client_id:=nullif(trim(p_data->>'mega_id'),'');
 energy_value:=case chosen.kind when 'energy' then p_data->>'energy' when 'telecom' then 'Telecom' else 'Autre' end;
 if chosen.kind='energy' and (energy_value is null or energy_value not in ('Elec','Gaz')) then raise exception 'Énergie requise';end if;comment_body:=trim(coalesce(p_data->>'comment',''));
 -- Never let an agent claim a sale already attributed to another agent or centre.
 if chosen.supplier='MEGA' and chosen.kind='energy' and exists(select 1 from public.be_contracts c where c.mega_id=client_id and c.energy=energy_value and (c.centre<>membership.centre or lower(trim(c.agent))<>lower(trim(membership.agent_ref)))) then raise exception 'Vente déjà attribuée à un autre agent ou centre';end if;
 if chosen.supplier='MEGA' and chosen.kind='energy' and exists(select 1 from public.be_contracts c where c.mega_id=client_id and c.energy=energy_value and coalesce(p_data->>'ean','')<>'' and c.ean is not null and c.ean<>p_data->>'ean') then raise exception 'EAN différent du reporting MEGA';end if;
 if length(comment_body)>5000 then raise exception 'Commentaire trop long';end if;
 insert into public.be_sale_entries(owner_id,owner_name,agent_ref,centre,mega_id,energy,ean,contract_reference,first_name,last_name,phone,email,product,product_id,submission_id)
 values(actor.id,actor.full_name,membership.agent_ref,membership.centre,client_id,energy_value,trim(coalesce(p_data->>'ean','')),left(trim(coalesce(p_data->>'contract_reference','')),100),trim(p_data->>'first_name'),trim(p_data->>'last_name'),trim(p_data->>'phone'),lower(trim(p_data->>'email')),chosen.label,chosen.id,coalesce(nullif(p_data->>'submission_id','')::uuid,gen_random_uuid())) returning id into result;
 if comment_body<>'' then perform private.be_save_comment(null,coalesce(client_id,'CRM:'||result::text),membership.centre,comment_body);end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.partner_team_stats()
 RETURNS TABLE(team_id uuid, membres bigint, prospects_actifs bigint, dossiers_en_cours bigint, dossiers_valides bigint)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
 if not coalesce((select public.is_admin()),false) then raise exception 'Accès réservé' using errcode='42501'; end if;
 return query
 with members as (
  select p.id,p.partner_team_id from public.profiles p where (p.permissions && array['crm']::text[]) and p.archived_at is null and p.partner_team_id is not null
 ), counts as (
  select m.partner_team_id, count(*) as n from members m group by m.partner_team_id
 ), prospects as (
  select m.partner_team_id, count(*) as n from members m join public.prospects p on p.assigned_to=m.id
  where p.deleted_at is null and p.stage not in ('KO','Numéro KO','Pas intéressé','DDF trop éloignée') group by m.partner_team_id
 ), affaires as (
  select m.partner_team_id, count(*) filter(where a.stage not in ('Signé','KO')) as encours,
   count(*) filter(where a.stage='Signé') as valides from members m join public.affaires a on a.commercial_id=m.id
  where a.deleted_at is null group by m.partner_team_id
 )
 select t.id,coalesce(c.n,0),coalesce(p.n,0),coalesce(a.encours,0),coalesce(a.valides,0)
 from public.partner_teams t left join counts c on c.partner_team_id=t.id left join prospects p on p.partner_team_id=t.id left join affaires a on a.partner_team_id=t.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.be_archive_agent(p_agent_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.be_sales_agents;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 select * into a from public.be_sales_agents where id=p_agent_id and archived_at is null for update;
 if not found then raise exception 'Agent introuvable'; end if;
 update public.profiles p set is_active=false where (p.permissions && array['belgique_encodage']::text[]) and exists(select 1 from public.be_access b where b.user_id=p.id and b.centre=a.centre and lower(trim(b.agent_ref))=lower(trim(a.agent_ref)));
 update public.be_access set is_active=false where centre=a.centre and lower(trim(agent_ref))=lower(trim(a.agent_ref));
 update public.be_sales_agents set archived_at=now(),is_active=false where id=p_agent_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.be_archive_centre(p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare center_name text;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 select name into center_name from public.be_centres where name=p_name and archived_at is null for update;
 if not found then raise exception 'Centre introuvable'; end if;
 update public.profiles p set is_active=false where (p.permissions && array['belgique_encodage','belgique_centre']::text[]) and exists(select 1 from public.be_access b where b.user_id=p.id and b.centre=center_name);
 update public.be_access set is_active=false where centre=center_name;
 update public.be_sales_agents set archived_at=now(),is_active=false where centre=center_name and archived_at is null;
 update public.be_centres set archived_at=now() where name=center_name;
end $function$
;

CREATE OR REPLACE FUNCTION public.be_centre_agents()
 RETURNS TABLE(agent_id uuid, display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select s.id,s.display_name from public.be_sales_agents s
 join public.be_access a on a.centre=s.centre and a.user_id=auth.uid() and a.is_active and a.agent_ref is null
 join public.profiles p on p.id=a.user_id and p.is_active and not p.must_change_password and (p.permissions && array['belgique_centre']::text[])
 where s.is_active and s.archived_at is null order by s.display_name,s.id
$function$
;

CREATE OR REPLACE FUNCTION public.be_encode_sale_for_agent(p_data jsonb, p_agent_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor public.profiles; membership public.be_access; agent public.be_sales_agents; chosen public.be_products; owner uuid; energy_value text; result uuid; comment_body text;
begin
 select * into actor from public.profiles where id=auth.uid() and is_active and (permissions && array['belgique_centre']::text[]) and not must_change_password;
 select * into membership from public.be_access where user_id=actor.id and is_active and agent_ref is null;
 select * into agent from public.be_sales_agents where id=p_agent_id and centre=membership.centre and is_active and archived_at is null;
 if actor.id is null or membership.user_id is null or agent.id is null then raise exception 'Accès encodage refusé' using errcode='42501'; end if;
 select * into chosen from public.be_products where is_active and id::text=p_data->>'product_id';
 if chosen.id is null then raise exception 'Sélectionne un produit actif'; end if;
 energy_value:=case chosen.kind when 'energy' then p_data->>'energy' when 'telecom' then 'Telecom' else 'Autre' end;
 if chosen.kind='energy' and (energy_value is null or energy_value not in ('Elec','Gaz')) then raise exception 'Énergie requise'; end if;
 comment_body:=trim(coalesce(p_data->>'comment',''));
 if length(comment_body)>5000 then raise exception 'Commentaire trop long'; end if;
 select a.user_id into owner from public.be_access a join public.profiles p on p.id=a.user_id and (p.permissions && array['belgique_encodage']::text[]) where a.centre=membership.centre and lower(trim(a.agent_ref))=lower(trim(agent.agent_ref)) limit 1;
 insert into public.be_sale_entries(owner_id,owner_name,encoded_by,agent_ref,centre,mega_id,energy,ean,contract_reference,first_name,last_name,phone,email,product,product_id,submission_id)
 values(coalesce(owner,actor.id),agent.display_name,actor.id,agent.agent_ref,membership.centre,null,energy_value,'','',trim(p_data->>'first_name'),trim(p_data->>'last_name'),trim(p_data->>'phone'),lower(trim(p_data->>'email')),chosen.label,chosen.id,coalesce(nullif(p_data->>'submission_id','')::uuid,gen_random_uuid())) returning id into result;
 if comment_body<>'' then perform private.be_save_comment(null,'CRM:'||result::text,membership.centre,comment_body);end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION private.be_attach_centre_sales()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.agent_ref is not null and exists(select 1 from public.profiles where id=new.user_id and (permissions && array['belgique_encodage']::text[])) then
  update public.be_sale_entries s set owner_id=new.user_id
  where s.centre=new.centre and lower(trim(s.agent_ref))=lower(trim(new.agent_ref)) and s.encoded_by is not null
    and exists(select 1 from public.profiles p where p.id=s.owner_id and (p.permissions && array['belgique_centre']::text[]));
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.adv_directory()
 RETURNS TABLE(id uuid, full_name text, commission_rate numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.can_process_adv() then raise exception 'Accès ADV refusé' using errcode='42501'; end if;
 return query select p.id,p.full_name,p.commission_rate from public.profiles p where p.is_active and ((p.permissions && array['crm','apporteur','equipe']::text[]) or exists(select 1 from public.acd_requests r where r.requested_by=p.id) or exists(select 1 from public.affaires a where a.commercial_id=p.id)) order by p.full_name;
end $function$
;
create function private.has_permission(p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and is_active and p_permission=any(permissions));
$$;
revoke all on function private.has_permission(text) from public,anon;
grant execute on function private.has_permission(text) to authenticated;
create function public.has_permission(p_permission text) returns boolean language sql stable security invoker set search_path='' as $$select private.has_permission(p_permission);$$;
revoke all on function public.has_permission(text) from public,anon;
grant execute on function public.has_permission(text) to authenticated;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select private.has_permission('administration');$$;
create or replace function public.can_manage() returns boolean language sql stable security definer set search_path='' as $$select private.has_permission('administration') or private.has_permission('crm_gestion');$$;
create or replace function public.can_view_all() returns boolean language sql stable security definer set search_path='' as $$select private.has_permission('administration') or private.has_permission('crm_lecture_globale');$$;
create or replace function private.is_adv_account() returns boolean language sql stable security definer set search_path='' as $$select private.has_permission('adv');$$;
create or replace function private.can_process_adv() returns boolean language sql stable security definer set search_path='' as $$select private.has_permission('administration') or private.has_permission('adv');$$;
-- Retired compatibility function: no caller may derive authorization from roles.
create or replace function public.current_role_name() returns text language sql stable set search_path='' as $$select null::text;$$;

-- Remove exclusive module restrictions. Additive boundaries below are independent
-- for reads and writes, with ownership retained by the existing permissive policies.
do $$ declare p record;begin
 for p in select * from pg_policies where schemaname in ('public','storage') and (policyname in ('quality_deny_direct','quality_deny_storage','adv_read_boundary','adv_insert_boundary','adv_update_boundary','adv_delete_boundary','adv_storage_boundary','affaires_no_partner','prospects_partner_no_insert','prospects_partner_no_update','acd_partner_no_insert','acd_partner_no_update','acd_meters_partner_no_insert')) loop
  execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
 end loop;
end $$;

create or replace function public.tg_handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name,email,commission_rate,must_change_password,permissions)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),new.email,0,true,'{}') on conflict(id) do nothing;
 return new;
end $$;
create or replace function public.tg_protect_profile_privileges() returns trigger language plpgsql set search_path='' as $$begin return new;end $$;

-- Re-express remaining quality policies using independent capabilities.
drop policy quality_insert on public.quality_reviews;
create policy quality_insert on public.quality_reviews for insert to authenticated with check((public.is_admin() or private.has_permission('qualite')) and controller_id=auth.uid());
drop policy quality_read on public.quality_reviews;
create policy quality_read on public.quality_reviews for select to authenticated using(public.is_admin() or private.has_permission('qualite') or auth.uid()=any(mentioned_ids));
drop policy quality_incidents_create on public.quality_incidents;
create policy quality_incidents_create on public.quality_incidents for insert to authenticated with check((public.is_admin() or private.has_permission('qualite')) and source='crm' and reporter_id=auth.uid() and status='ouvert');
drop policy quality_incidents_update on public.quality_incidents;
create policy quality_incidents_update on public.quality_incidents for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy quality_incidents_read on public.quality_incidents;
create policy quality_incidents_read on public.quality_incidents for select to authenticated using(public.is_admin() or private.has_permission('qualite') or auth.uid()=any(mentioned_ids));
drop policy quality_read_sales_agents on public.be_sales_agents;
create policy quality_read_sales_agents on public.be_sales_agents for select to authenticated using(private.has_permission('qualite') or private.has_permission('belgique_lecture'));

-- Module gates constrain legacy ownership policies without making permissions
-- exclusive. The RLS checks underneath still enforce own dossier / own centre.
do $$ declare t record; read_keys text[]; write_keys text[]; expr text; wexpr text;
begin
 for t in select tablename from pg_tables where schemaname='public' loop
  read_keys:=case
   when t.tablename in ('profiles','crm_notifications','quality_reviews','quality_review_comments','quality_incidents','quality_incident_comments') then null
   when t.tablename like 'be_%' then array['qualite','belgique_lecture','belgique_centre','belgique_encodage']
   when t.tablename in ('partner_dossiers','partner_quotes','partner_messages') then array['apporteur','adv']
   when t.tablename in ('pieces_jointes','prospects','entreprises','crm_contacts','contact_entreprises','prospect_contacts','prospect_compteurs','contrats_energie','acd_requests','acd_request_meters') then array['crm','apporteur','adv']
   when t.tablename in ('affaires','affaire_adv_checks') then array['crm','adv']
   when t.tablename in ('email_messages','email_templates','email_signatures','email_accounts','email_account_members') then array['email']
   when t.tablename in ('calendar_events') then array['crm','adv']
   when t.tablename in ('partner_teams') then array['equipe','crm_gestion']
   else array['crm'] end;
  write_keys:=case
   when t.tablename in ('profiles','crm_notifications','quality_reviews','quality_review_comments','quality_incidents','quality_incident_comments') then null
   when t.tablename in ('pieces_jointes') then array['crm','apporteur','adv']
   when t.tablename in ('email_messages','email_templates','email_signatures','email_accounts','email_account_members') then array['email']
   when t.tablename like 'be_%' then '{}'::text[]
   when t.tablename in ('partner_dossiers','partner_quotes','partner_messages','affaire_adv_checks','acd_requests') then '{}'::text[]
   else array['crm'] end;
  expr:=case when read_keys is null then '(select public.is_active_user())' else format('(select public.is_admin()) or exists(select 1 from unnest(%L::text[]) k where private.has_permission(k))',read_keys) end;
  wexpr:=case when write_keys is null then '(select public.is_active_user())' else format('(select public.is_admin()) or exists(select 1 from unnest(%L::text[]) k where private.has_permission(k))',write_keys) end;
  execute format('create policy permissions_read on public.%I as restrictive for select to authenticated using (%s)',t.tablename,expr);
  execute format('create policy permissions_insert on public.%I as restrictive for insert to authenticated with check (%s)',t.tablename,case when t.tablename='acd_requests' then '(select public.is_admin()) or (select private.has_permission(''crm''))' else wexpr end);
  execute format('create policy permissions_update on public.%I as restrictive for update to authenticated using (%s) with check (%s)',t.tablename,wexpr,wexpr);
  execute format('create policy permissions_delete on public.%I as restrictive for delete to authenticated using (%s)',t.tablename,wexpr);
 end loop;
end $$;
create policy permissions_storage on storage.objects as restrictive for all to authenticated using((select public.is_active_user()) and ((select public.is_admin()) or (select private.has_permission('crm')) or (select private.has_permission('apporteur')) or (select private.has_permission('adv')))) with check((select public.is_active_user()) and ((select public.is_admin()) or (select private.has_permission('crm')) or (select private.has_permission('apporteur')) or (select private.has_permission('adv'))));
-- An ADV-only user may add/read documents but cannot use ordinary CRM REST writes.
-- A CRM+ADV user can also use their ordinary CRM actions, subject to ownership.

create function private.guard_last_administration_permission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.is_active and 'administration'=any(old.permissions) and (not new.is_active or not ('administration'=any(new.permissions))) then
  perform pg_advisory_xact_lock(52161121);
  if not exists(select 1 from public.profiles where id<>old.id and is_active and 'administration'=any(permissions)) then raise exception 'Conservez au moins un compte actif avec la permission d’administration' using errcode='42501';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_last_administration_permission() from public,anon,authenticated;
create trigger guard_last_administration_permission before update on public.profiles for each row execute function private.guard_last_administration_permission();
create function private.set_profile_permissions(p_id uuid,p_permissions text[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_permission('administration') then raise exception 'Administration requise' using errcode='42501';end if;
 if p_permissions is null then raise exception 'Permissions requises';end if;
 perform pg_advisory_xact_lock(52161121);
 update public.profiles set permissions=coalesce((select array_agg(distinct k order by k) from unnest(p_permissions) k),'{}') where id=p_id and archived_at is null;
 if not found then raise exception 'Compte introuvable';end if;
end $$;
create function public.set_profile_permissions(p_id uuid,p_permissions text[]) returns void language sql security invoker set search_path='' as $$select private.set_profile_permissions(p_id,p_permissions);$$;
revoke all on function private.set_profile_permissions(uuid,text[]),public.set_profile_permissions(uuid,text[]) from public,anon;
grant execute on function private.set_profile_permissions(uuid,text[]),public.set_profile_permissions(uuid,text[]) to authenticated;
-- The historical role and boolean columns are intentionally no longer authority.
comment on column public.profiles.role is 'Obsolete compatibility data. Authorization uses permissions only.';
comment on column public.profiles.permissions is 'Cumulative account permissions. Writable only by administration.';
drop policy read_catalog on public.be_products;
create policy read_catalog on public.be_products for select to authenticated using((is_active or public.is_admin()) and (public.is_admin() or private.has_permission('qualite') or private.has_permission('belgique_lecture') or private.has_permission('belgique_centre') or private.has_permission('belgique_encodage')));
commit;
