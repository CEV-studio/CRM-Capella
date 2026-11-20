begin;
-- Older databases may have this operational field outside migration history.
alter table public.prospects add column if not exists acd_downloaded_at timestamptz;
-- No existing account is assigned this role.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','commercial','manager','apporteur','qualite','be_centre','be_agent','agent_ia','adv'));
alter table public.profiles add constraint adv_private check(role<>'adv' or (not can_export and not can_view_all and not can_manage_team and commission_rate=0 and manager_id is null and partner_team_id is null and hierarchy_title is null));

-- Private authorization lookups avoid recursive profile RLS and stale JWT roles.
create function private.is_adv_account() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='adv');
$$;
create function private.can_process_adv() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('admin','adv'));
$$;
create function private.adv_prospect(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_process_adv() and exists(select 1 from public.prospects p where p.id=p_id and p.deleted_at is null and (
 exists(select 1 from public.acd_requests r where r.prospect_id=p.id) or
 exists(select 1 from public.affaires a where a.prospect_id=p.id and a.deleted_at is null) or
 exists(select 1 from public.partner_dossiers d where d.prospect_id=p.id)));
$$;
create function private.adv_affaire(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_process_adv() and exists(select 1 from public.affaires where id=p_id and deleted_at is null);
$$;
create function private.adv_storage(p_name text) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_process_adv() then return false; end if;
 if split_part(p_name,'/',1)='prospects' then return private.adv_prospect(split_part(p_name,'/',2)::uuid); end if;
 if split_part(p_name,'/',1)='affaires' then return private.adv_affaire(split_part(p_name,'/',2)::uuid); end if;
 return false;
exception when invalid_text_representation then return false;
end $$;
revoke all on function private.is_adv_account(),private.can_process_adv(),private.adv_prospect(uuid),private.adv_affaire(uuid),private.adv_storage(text) from public,anon;
grant execute on function private.is_adv_account(),private.can_process_adv(),private.adv_prospect(uuid),private.adv_affaire(uuid),private.adv_storage(text) to authenticated;

-- Restrict this new role even when a legacy ownership policy would allow more.
-- Existing roles retain their policies. Mutations of business rows go through
-- the narrow transactional commands below, not arbitrary REST updates.
do $$ declare t record; read_ok text; write_ok text;
begin
 for t in select tablename from pg_tables where schemaname='public' loop
  read_ok:=case when t.tablename in ('profiles','crm_notifications','affaires','prospects','acd_requests','acd_request_meters','affaire_adv_checks','partner_dossiers','partner_quotes','partner_messages','pieces_jointes','calendar_events','entreprises','crm_contacts','contact_entreprises','prospect_contacts','prospect_compteurs','contrats_energie','prospect_stages','affaire_stages','fournisseurs') then 'public.is_active_user()' else 'false' end;
  -- The inactive user's own profile must remain readable to reject the session.
  if t.tablename='profiles' then read_ok:='id=auth.uid()'; end if;
  write_ok:=case when t.tablename in ('profiles','crm_notifications','pieces_jointes') then 'public.is_active_user()' else 'false' end;
  execute format('create policy adv_read_boundary on public.%I as restrictive for select to authenticated using (not (select private.is_adv_account()) or (%s))',t.tablename,read_ok);
  execute format('create policy adv_insert_boundary on public.%I as restrictive for insert to authenticated with check (not (select private.is_adv_account()) or (%s))',t.tablename,case when t.tablename='pieces_jointes' then write_ok else 'false' end);
  execute format('create policy adv_update_boundary on public.%I as restrictive for update to authenticated using (not (select private.is_adv_account()) or (%s)) with check (not (select private.is_adv_account()) or (%s))',t.tablename,write_ok,write_ok);
  execute format('create policy adv_delete_boundary on public.%I as restrictive for delete to authenticated using (not (select private.is_adv_account()) or (%s))',t.tablename,case when t.tablename='pieces_jointes' then write_ok else 'false' end);
 end loop;
end $$;
create policy adv_affaires_read on public.affaires for select to authenticated using(private.can_process_adv() and deleted_at is null);
create policy adv_prospects_read on public.prospects for select to authenticated using(private.adv_prospect(id));
create policy adv_acd_read on public.acd_requests for select to authenticated using(private.adv_prospect(prospect_id));
create policy adv_acd_meters_read on public.acd_request_meters for select to authenticated using(private.can_process_adv() and exists(select 1 from public.acd_requests r where r.id=request_id));
create policy adv_checks_read on public.affaire_adv_checks for select to authenticated using(private.adv_affaire(affaire_id));
create policy adv_dossiers_read on public.partner_dossiers for select to authenticated using(private.adv_prospect(prospect_id));
create policy adv_calendar_read on public.calendar_events for select to authenticated using(private.adv_prospect(prospect_id));
create policy adv_entreprises_read on public.entreprises for select to authenticated using(private.can_process_adv() and exists(select 1 from public.prospects p where p.entreprise_id=entreprises.id and private.adv_prospect(p.id)));
create policy adv_contacts_read on public.prospect_contacts for select to authenticated using(private.adv_prospect(prospect_id));
create policy adv_contact_links_read on public.contact_entreprises for select to authenticated using(private.can_process_adv() and exists(select 1 from public.prospects p where p.entreprise_id=contact_entreprises.entreprise_id and private.adv_prospect(p.id)));
create policy adv_crm_contacts_read on public.crm_contacts for select to authenticated using(private.can_process_adv() and exists(select 1 from public.contact_entreprises ce where ce.contact_id=crm_contacts.id));
create policy adv_contracts_read on public.contrats_energie for select to authenticated using(private.can_process_adv() and exists(select 1 from public.prospects p where p.entreprise_id=contrats_energie.entreprise_id and private.adv_prospect(p.id)));
create policy adv_compteurs_read on public.prospect_compteurs for select to authenticated using(private.adv_prospect(prospect_id));
create policy adv_pieces_read on public.pieces_jointes for select to authenticated using(private.adv_prospect(prospect_id) or private.adv_affaire(affaire_id));
create policy adv_pieces_insert on public.pieces_jointes for insert to authenticated with check((private.adv_prospect(prospect_id) or private.adv_affaire(affaire_id)) and private.adv_storage(bucket_path) and (bucket_path like 'prospects/'||prospect_id::text||'/%' or bucket_path like 'affaires/'||affaire_id::text||'/%'));
create policy adv_pieces_delete on public.pieces_jointes for delete to authenticated using(private.adv_prospect(prospect_id) or private.adv_affaire(affaire_id));
create policy adv_storage_boundary on storage.objects as restrictive for all to authenticated using(not (select private.is_adv_account()) or (public.is_active_user() and bucket_id='pieces-jointes' and private.adv_storage(name))) with check(not (select private.is_adv_account()) or (public.is_active_user() and bucket_id='pieces-jointes' and private.adv_storage(name)));
create policy adv_storage_read on storage.objects for select to authenticated using(bucket_id='pieces-jointes' and private.adv_storage(name));
create policy adv_storage_insert on storage.objects for insert to authenticated with check(bucket_id='pieces-jointes' and private.adv_storage(name));
create policy adv_storage_delete on storage.objects for delete to authenticated using(bucket_id='pieces-jointes' and private.adv_storage(name));

-- ADV can mark its own notifications read, never forge recipients or email content.
create function private.adv_notification_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if private.is_adv_account() and (to_jsonb(new)-'read_at') is distinct from (to_jsonb(old)-'read_at') then
  raise exception 'Seule la lecture de notification peut être modifiée' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.adv_notification_guard() from public,anon,authenticated;
create trigger adv_notification_guard before update on public.crm_notifications for each row execute function private.adv_notification_guard();

create function private.adv_directory() returns table(id uuid,full_name text,commission_rate numeric) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_process_adv() then raise exception 'Accès ADV refusé' using errcode='42501'; end if;
 return query select p.id,p.full_name,p.commission_rate from public.profiles p where p.is_active and (p.role in ('commercial','apporteur','manager') or exists(select 1 from public.acd_requests r where r.requested_by=p.id) or exists(select 1 from public.affaires a where a.commercial_id=p.id)) order by p.full_name;
end $$;
create function public.adv_directory() returns table(id uuid,full_name text,commission_rate numeric) language sql security invoker set search_path='' as $$ select * from private.adv_directory(); $$;

create function private.adv_save(p_id uuid,p_stage text,p_commission numeric,p_signature date,p_relance date,p_verification boolean) returns void language plpgsql security definer set search_path='' as $$
declare a public.affaires;
begin
 if not private.can_process_adv() then raise exception 'Accès ADV refusé' using errcode='42501'; end if;
 if p_stage is null or p_stage not in ('Demande de cotation','Comparatif','RDV','RIB','Signé') or p_commission is null or p_commission<0 or p_commission='NaN'::numeric or p_commission='Infinity'::numeric or (p_stage='Signé' and p_commission<=0) then raise exception 'Statut ou commission invalide'; end if;
 select * into a from public.affaires where id=p_id and deleted_at is null for update;
 if not found then raise exception 'Dossier introuvable'; end if;
 if a.stage='KO' then raise exception 'Le KO est décidé par le commercial'; end if;
 update public.affaires set stage=p_stage,commission=p_commission,date_relance=p_relance,date_signature=case when p_stage='Signé' then coalesce(p_signature,current_date) else date_signature end where id=p_id;
 if p_verification is not null then
  insert into public.affaire_adv_checks(affaire_id,verification_calls,checked_by,updated_at) values(p_id,p_verification,auth.uid(),now()) on conflict(affaire_id) do update set verification_calls=excluded.verification_calls,checked_by=excluded.checked_by,updated_at=excluded.updated_at;
 end if;
end $$;
create function public.adv_save(p_id uuid,p_stage text,p_commission numeric,p_signature date,p_relance date,p_verification boolean) returns void language sql security invoker set search_path='' as $$ select private.adv_save(p_id,p_stage,p_commission,p_signature,p_relance,p_verification); $$;

create function private.adv_acd_status(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare r public.acd_requests; p public.prospects;
begin
 if not private.can_process_adv() then raise exception 'Accès ADV refusé' using errcode='42501'; end if;
 if p_status is null or p_status not in ('a_traiter','en_cours','envoyee','terminee','annulee') then raise exception 'Statut invalide'; end if;
 select * into r from public.acd_requests where id=p_id for update;
 if not found then raise exception 'Demande introuvable'; end if;
 select * into p from public.prospects where id=r.prospect_id and deleted_at is null for update;
 if not found then raise exception 'Prospect introuvable'; end if;
 if p_status='terminee' and not exists(select 1 from public.partner_dossiers where acd_request_id=r.id) then
  if not exists(select 1 from public.affaires where prospect_id=p.id and deleted_at is null) then
   insert into public.affaires(commercial_id,prospect_id,source_id,raison_sociale,siren,nom,prenom,mail,telephone,pdl_elec,pce_gaz,fournisseur,date_echeance,sans_engagement,notes,stage,created_by)
   values(coalesce(p.assigned_to,auth.uid()),p.id,p.source_id,coalesce(p.raison_sociale,nullif(concat_ws(' ',p.prenom,p.nom),''),'(sans nom)'),p.siren,p.nom,p.prenom,p.mail,coalesce(p.tel_mobile,p.tel_fixe),p.pdl,p.pce,coalesce(p.fournisseur_electricite,p.fournisseur_gaz),p.date_fin_contrat,p.sans_engagement,p.notes,'Demande de cotation',auth.uid());
  end if;
  update public.prospects set stage='Demande de cotation',entered_conversion_at=coalesce(entered_conversion_at,now()),last_action_at=now() where id=p.id;
 end if;
 update public.acd_requests set status=p_status,processed_by=auth.uid(),processed_at=case when p_status in ('terminee','annulee') then now() else null end where id=p_id;
end $$;
create function public.adv_acd_status(p_id uuid,p_status text) returns void language sql security invoker set search_path='' as $$ select private.adv_acd_status(p_id,p_status); $$;
create function private.adv_acd_download(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.can_process_adv() or not private.adv_prospect(p_id) then raise exception 'Accès ADV refusé' using errcode='42501'; end if;
 update public.prospects set acd_downloaded_at=now() where id=p_id and stage='Demande ACD' and deleted_at is null;
end $$;
create function public.adv_acd_download(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.adv_acd_download(p_id); $$;
revoke all on function private.adv_directory(),public.adv_directory(),private.adv_save(uuid,text,numeric,date,date,boolean),public.adv_save(uuid,text,numeric,date,date,boolean),private.adv_acd_status(uuid,text),public.adv_acd_status(uuid,text),private.adv_acd_download(uuid),public.adv_acd_download(uuid) from public,anon;
grant execute on function private.adv_directory(),public.adv_directory(),private.adv_save(uuid,text,numeric,date,date,boolean),public.adv_save(uuid,text,numeric,date,date,boolean),private.adv_acd_status(uuid,text),public.adv_acd_status(uuid,text),private.adv_acd_download(uuid),public.adv_acd_download(uuid) to authenticated;
-- Preserve validated partner operations; ADV may only quote, exchange and publish documents.
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
 if me.id is null or me.role not in ('admin','adv','apporteur') then raise exception 'Accès refusé'; end if;
 if me.role='adv' and p_action not in ('read','quote','documents','message') then raise exception 'Action ADV refusée' using errcode='42501'; end if;
 if p_action='read' then
  update public.crm_notifications set read_at=now() where id=p_id and recipient_id=me.id;
  return p_id;
 end if;
 if p_action='draft' then
  if coalesce(p_data->>'siret','') !~ '^[0-9]{14}$' or length(trim(coalesce(p_data->>'raison_sociale','')))=0 then raise exception 'SIRET et raison sociale obligatoires'; end if;
  -- Client generated key makes retries idempotent, including after a lost HTTP response.
  select * into d from public.partner_dossiers where id=p_id;
  if found then
   if d.owner_id<>me.id and me.role not in ('admin','adv') then raise exception 'Accès refusé'; end if;
   return d.id;
  end if;
  insert into public.prospects(raison_sociale,siren,assigned_to,created_by) values(p_data->>'raison_sociale',left(p_data->>'siret',9),me.id,me.id) returning id into pid;
  insert into public.partner_dossiers(id,owner_id,prospect_id,company_name,siret,details)
  values(p_id,me.id,pid,p_data->>'raison_sociale',p_data->>'siret',p_data) returning id into result_id;
  return result_id;
 end if;
 select * into d from public.partner_dossiers where id=p_id for update;
 if not found or (d.owner_id<>me.id and me.role not in ('admin','adv')) then raise exception 'Dossier introuvable'; end if;
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
  if me.role not in ('admin','adv') then raise exception 'Accès administrateur requis'; end if;
  perform private.partner_notify(d.id,'Documents disponibles',d.company_name||' — consultez les nouveaux documents dans votre dossier.',false);
 elsif p_action='message' then
  if coalesce(p_data->>'kind','message') not in ('message','contrat') then raise exception 'Type de message invalide'; end if;
  if nullif(p_data->>'quote_id','') is not null then
   select * into q from public.partner_quotes where id=(p_data->>'quote_id')::uuid and dossier_id=d.id;
   if not found then raise exception 'Cotation introuvable'; end if;
  elsif p_data->>'kind'='contrat' then raise exception 'Sélectionnez la cotation pour le contrat'; end if;
  insert into public.partner_messages(dossier_id,quote_id,author_id,kind,body) values(d.id,q.id,me.id,coalesce(p_data->>'kind','message'),p_data->>'body');
  perform private.partner_notify(d.id,case when p_data->>'kind'='contrat' then 'Envoi de contrat demandé' else 'Nouveau message' end,d.company_name||' — '||(p_data->>'body'),me.role not in ('admin','adv'));
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
    case when p_admin and p.role='admin' then 'jeremy@capellaenergy.fr' else p.email end
  from public.partner_dossiers d
  join public.profiles p
    on ((p_admin and p.role in ('admin','adv')) or (not p_admin and p.id=d.owner_id))
  where d.id=p_dossier and p.is_active;
end;
$function$
;
commit;
