-- One dossier per opportunity; existing prospects/ACD/ADV remain the source of truth.
begin;
-- Existing client-stage trigger also needs this column on a fresh installation.
alter table public.prospects add column if not exists became_client_at timestamptz;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','commercial','apporteur'));
alter table public.profiles add constraint apporteur_private check(role <> 'apporteur' or (not can_view_all and not can_manage_team and not can_export));
alter table public.pieces_jointes drop constraint pieces_jointes_type_check;
alter table public.pieces_jointes add constraint pieces_jointes_type_check check(type in ('ACD','Facture','Contrat','Offre'));

create table public.partner_dossiers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 prospect_id uuid not null unique references public.prospects(id),
 company_name text not null,
 siret text not null check(siret ~ '^[0-9]{14}$'),
 details jsonb not null default '{}',
 acd_status text not null default 'brouillon' check(acd_status in ('brouillon','envoyee','signee','annulee')),
 acd_request_id uuid references public.acd_requests(id),
 last_resend_at timestamptz,
 created_at timestamptz not null default now()
);
create index partner_dossiers_owner on public.partner_dossiers(owner_id,created_at desc);
create table public.partner_quotes (
 id uuid primary key default gen_random_uuid(), dossier_id uuid not null references public.partner_dossiers(id),
 affaire_id uuid not null unique references public.affaires(id),
 request_key uuid not null unique,
 start_date date not null, end_date date not null check(end_date>start_date), quote_date date not null,
 meters jsonb not null check(jsonb_array_length(meters)>0),
 is_regie boolean not null default false, offer_market boolean not null default false, offer_other boolean not null default false,
 comment text not null check(length(trim(comment))>0),
 status text not null default 'Demande de cotation',
 supplier text, signed_at date, partner_commission numeric(12,2),
 created_at timestamptz not null default now()
);
create index partner_quotes_dossier on public.partner_quotes(dossier_id,created_at desc);
create table public.partner_messages (
 id uuid primary key default gen_random_uuid(), dossier_id uuid not null references public.partner_dossiers(id),
 quote_id uuid references public.partner_quotes(id), author_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('message','contrat')), body text not null check(length(trim(body)) between 1 and 5000),
 created_at timestamptz not null default now()
);
create index partner_messages_dossier on public.partner_messages(dossier_id,created_at);
create table public.crm_notifications (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id),
 actor_id uuid references public.profiles(id), dossier_id uuid references public.partner_dossiers(id),
 title text not null, body text not null, href text not null, read_at timestamptz,
 email_to text not null, email_status text not null default 'pending' check(email_status in ('pending','sending','sent','failed')),
 email_error text, email_attempt_at timestamptz, created_at timestamptz not null default now()
);
create index crm_notifications_recipient on public.crm_notifications(recipient_id,created_at desc);
create index crm_notifications_pending on public.crm_notifications(actor_id,created_at) where email_status in ('pending','failed');
create table public.affaire_adv_checks (
 affaire_id uuid primary key references public.affaires(id), verification_calls boolean not null default false,
 checked_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);

alter table public.partner_dossiers enable row level security;
alter table public.partner_quotes enable row level security;
alter table public.partner_messages enable row level security;
alter table public.crm_notifications enable row level security;
alter table public.affaire_adv_checks enable row level security;
revoke all on public.partner_dossiers,public.partner_quotes,public.partner_messages,public.crm_notifications,public.affaire_adv_checks from anon,authenticated;
grant select on public.partner_dossiers,public.partner_quotes,public.partner_messages,public.crm_notifications to authenticated;
grant select,insert,update on public.affaire_adv_checks to authenticated;
grant all on public.partner_dossiers,public.partner_quotes,public.partner_messages,public.crm_notifications,public.affaire_adv_checks to service_role;
create policy partner_dossiers_read on public.partner_dossiers for select to authenticated using(public.is_active_user() and (public.is_admin() or owner_id=auth.uid()));
create policy partner_quotes_read on public.partner_quotes for select to authenticated using(exists(select 1 from public.partner_dossiers d where d.id=dossier_id));
create policy partner_messages_read on public.partner_messages for select to authenticated using(exists(select 1 from public.partner_dossiers d where d.id=dossier_id));
create policy crm_notifications_read on public.crm_notifications for select to authenticated using(public.is_active_user() and recipient_id=auth.uid());
create policy affaire_adv_checks_admin on public.affaire_adv_checks for all to authenticated using(public.is_admin()) with check(public.is_admin());
-- Raw affaires contain the global margin: apporteurs only get the safe projection above.
create policy affaires_no_partner on public.affaires as restrictive for all to authenticated using(public.current_role_name()<>'apporteur') with check(public.current_role_name()<>'apporteur');
-- Block direct prospect mutations by partners; the validated transactional command is their write API.
create policy prospects_partner_no_insert on public.prospects as restrictive for insert to authenticated with check(public.current_role_name()<>'apporteur');
create policy prospects_partner_no_update on public.prospects as restrictive for update to authenticated using(public.current_role_name()<>'apporteur') with check(public.current_role_name()<>'apporteur');
create policy acd_partner_no_insert on public.acd_requests as restrictive for insert to authenticated with check(public.current_role_name()<>'apporteur');
create policy acd_partner_no_update on public.acd_requests as restrictive for update to authenticated using(public.current_role_name()<>'apporteur') with check(public.current_role_name()<>'apporteur');

create policy partner_pieces_active on public.pieces_jointes as restrictive for all to authenticated using(public.is_active_user()) with check(public.is_active_user());
create policy partner_storage_active on storage.objects as restrictive for all to authenticated using(bucket_id<>'pieces-jointes' or public.is_active_user()) with check(bucket_id<>'pieces-jointes' or public.is_active_user());
create policy acd_meters_partner_no_insert on public.acd_request_meters as restrictive for insert to authenticated with check(public.current_role_name()<>'apporteur');

create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
-- Internal only; never exposed through PostgREST. Every entry point checks a live profile.
create function private.partner_notify(p_dossier uuid,p_title text,p_body text,p_admin boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.is_active_user() then raise exception 'Non autorisé'; end if;
 insert into public.crm_notifications(recipient_id,actor_id,dossier_id,title,body,href,email_to)
 select p.id,auth.uid(),d.id,p_title,p_body,'/partenaires/dossiers/'||d.id,
 case when p_admin then 'jeremy@capellaenergy.fr' else p.email end
 from public.partner_dossiers d join public.profiles p on
 ((p_admin and p.role='admin') or (not p_admin and p.id=d.owner_id))
 where d.id=p_dossier and p.is_active;
end $$;
revoke all on function private.partner_notify(uuid,text,text,boolean) from public,anon,authenticated;

create function private.partner_command(p_action text,p_id uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare me public.profiles; d public.partner_dossiers; q public.partner_quotes; payload jsonb; m jsonb;
 pid uuid; rid uuid; aid uuid; result_id uuid; first_pdl text; first_pce text; expiry date;
begin
 select * into me from public.profiles where id=auth.uid() and is_active;
 if me.id is null or me.role not in ('admin','apporteur') then raise exception 'Accès refusé'; end if;
 if p_action='read' then
  update public.crm_notifications set read_at=now() where id=p_id and recipient_id=me.id;
  return p_id;
 end if;
 if p_action='draft' then
  if coalesce(p_data->>'siret','') !~ '^[0-9]{14}$' or length(trim(coalesce(p_data->>'raison_sociale','')))=0 then raise exception 'SIRET et raison sociale obligatoires'; end if;
  -- Client generated key makes retries idempotent, including after a lost HTTP response.
  select * into d from public.partner_dossiers where id=p_id;
  if found then
   if d.owner_id<>me.id and me.role<>'admin' then raise exception 'Accès refusé'; end if;
   return d.id;
  end if;
  insert into public.prospects(raison_sociale,siren,assigned_to,created_by) values(p_data->>'raison_sociale',left(p_data->>'siret',9),me.id,me.id) returning id into pid;
  insert into public.partner_dossiers(id,owner_id,prospect_id,company_name,siret,details)
  values(p_id,me.id,pid,p_data->>'raison_sociale',p_data->>'siret',p_data) returning id into result_id;
  return result_id;
 end if;
 select * into d from public.partner_dossiers where id=p_id for update;
 if not found or (d.owner_id<>me.id and me.role<>'admin') then raise exception 'Dossier introuvable'; end if;
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
  if me.role<>'admin' then raise exception 'Accès administrateur requis'; end if;
  perform private.partner_notify(d.id,'Documents disponibles',d.company_name||' — consultez les nouveaux documents dans votre dossier.',false);
 elsif p_action='message' then
  if coalesce(p_data->>'kind','message') not in ('message','contrat') then raise exception 'Type de message invalide'; end if;
  if nullif(p_data->>'quote_id','') is not null then
   select * into q from public.partner_quotes where id=(p_data->>'quote_id')::uuid and dossier_id=d.id;
   if not found then raise exception 'Cotation introuvable'; end if;
  elsif p_data->>'kind'='contrat' then raise exception 'Sélectionnez la cotation pour le contrat'; end if;
  insert into public.partner_messages(dossier_id,quote_id,author_id,kind,body) values(d.id,q.id,me.id,coalesce(p_data->>'kind','message'),p_data->>'body');
  perform private.partner_notify(d.id,case when p_data->>'kind'='contrat' then 'Envoi de contrat demandé' else 'Nouveau message' end,d.company_name||' — '||(p_data->>'body'),me.role<>'admin');
 else raise exception 'Action inconnue';
 end if;
 return result_id;
end $$;
revoke all on function private.partner_command(text,uuid,jsonb) from public,anon;
grant execute on function private.partner_command(text,uuid,jsonb) to authenticated;
create function public.partner_command(p_action text,p_id uuid,p_data jsonb default '{}') returns uuid language sql security invoker set search_path=public,pg_temp as $$ select private.partner_command(p_action,p_id,p_data); $$;
revoke all on function public.partner_command(text,uuid,jsonb) from public,anon;
grant execute on function public.partner_command(text,uuid,jsonb) to authenticated;

create function private.partner_acd_sync() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare did uuid;
begin
 if new.status is distinct from old.status and new.status in ('terminee','annulee','a_traiter','en_cours') then
  update public.partner_dossiers set acd_status=case when new.status='terminee' then 'signee' when new.status='annulee' then 'annulee' else 'envoyee' end where acd_request_id=new.id returning id into did;
  if did is not null and new.status='terminee' then perform private.partner_notify(did,'ACD signée','Vous pouvez maintenant demander une cotation.',false); end if;
 end if;
 return new;
end $$;
revoke all on function private.partner_acd_sync() from public,anon,authenticated;
create trigger partner_acd_sync after update on public.acd_requests for each row execute function private.partner_acd_sync();
create function private.partner_affaire_sync() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare did uuid;
begin
 update public.partner_quotes set status=new.stage,supplier=new.fournisseur,signed_at=new.date_signature,
 partner_commission=case when new.stage<>'Signé' then null when old.stage='Signé' and new.commission is not distinct from old.commission then partner_commission else round(new.commission*(select commission_rate from public.profiles where id=new.commercial_id),2) end where affaire_id=new.id returning dossier_id into did;
 if did is not null and new.stage is distinct from old.stage then perform private.partner_notify(did,'Avancement de votre dossier',new.raison_sociale||' — '||new.stage,false); end if;
 return new;
end $$;
revoke all on function private.partner_affaire_sync() from public,anon,authenticated;
create trigger partner_affaire_sync after update on public.affaires for each row execute function private.partner_affaire_sync();
commit;
