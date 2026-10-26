create unique index be_access_agent_identity on public.be_access(centre,lower(trim(agent_ref))) where agent_ref is not null;

create table public.be_sale_entries(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 owner_name text not null, agent_ref text not null, centre text not null,
 mega_id text not null check(mega_id ~ '^[0-9]{1,20}$'),
 energy text not null check(energy in ('Elec','Gaz')),
 ean text not null default '' check(ean='' or ean ~ '^[0-9]{18}$'),
 contract_reference text not null default '',
 first_name text not null check(length(trim(first_name)) between 1 and 100),
 last_name text not null check(length(trim(last_name)) between 1 and 100),
 phone text not null check(length(trim(phone)) between 6 and 40),
 email text not null check(length(email) between 3 and 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
 product text not null default '' check(length(product)<=200),
 status text not null default 'Signé' check(status='Signé'),
 created_at timestamptz not null default now(),
 unique(mega_id,energy)
);
create index be_sale_entries_scope on public.be_sale_entries(centre,owner_id);

create function private.be_client_access(p_id text,p_centre text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and (
 p.role in ('admin','qualite') or p.role in ('be_centre','be_agent') and exists(
 select 1 from public.be_access a where a.user_id=p.id and a.is_active and a.centre=p_centre and (
 p.role='be_centre' and a.agent_ref is null or p.role='be_agent' and a.agent_ref is not null and (
 exists(select 1 from public.be_contracts c where c.mega_id=p_id and c.centre=a.centre and lower(trim(c.agent))=lower(trim(a.agent_ref))) or
 exists(select 1 from public.be_sale_entries s where s.mega_id=p_id and s.centre=a.centre and s.owner_id=p.id)))))
 );
$$;
revoke all on function private.be_client_access(text,text) from public,anon;
grant execute on function private.be_client_access(text,text) to authenticated;

create function private.be_entry_access(p_owner uuid,p_centre text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and (p.role in ('admin','qualite') or exists(
 select 1 from public.be_access a where a.user_id=p.id and a.is_active and a.centre=p_centre and (
 p.role='be_centre' and a.agent_ref is null or p.role='be_agent' and a.agent_ref is not null and p_owner=p.id))))
$$;
revoke all on function private.be_entry_access(uuid,text) from public,anon;
grant execute on function private.be_entry_access(uuid,text) to authenticated;
alter table public.be_sale_entries enable row level security;
create policy read_scope on public.be_sale_entries for select to authenticated using(private.be_entry_access(owner_id,centre));
revoke all on public.be_sale_entries from anon,authenticated;
grant select on public.be_sale_entries to authenticated;

create table public.be_client_comments(
 id uuid primary key default gen_random_uuid(), mega_id text not null, centre text not null,
 author_id uuid not null references public.profiles(id),author_name text not null,
 body text not null check(length(trim(body)) between 1 and 5000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index be_client_comments_scope on public.be_client_comments(mega_id,centre);
create table public.be_comment_history(
 id uuid primary key default gen_random_uuid(),comment_id uuid not null references public.be_client_comments(id),
 mega_id text not null,centre text not null,editor_id uuid not null references public.profiles(id),editor_name text not null,
 before_body text,after_body text not null,created_at timestamptz not null default now()
);
alter table public.be_client_comments enable row level security;
alter table public.be_comment_history enable row level security;
create policy read_scope on public.be_client_comments for select to authenticated using(private.be_client_access(mega_id,centre));
create policy read_scope on public.be_comment_history for select to authenticated using(private.be_client_access(mega_id,centre));
revoke all on public.be_client_comments,public.be_comment_history from anon,authenticated;
grant select on public.be_client_comments,public.be_comment_history to authenticated;

create function private.be_save_comment(p_id uuid,p_mega text,p_centre text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.profiles; previous public.be_client_comments; result uuid;
begin
 select * into actor from public.profiles where id=auth.uid() and is_active;
 if actor.id is null or not private.be_client_access(p_mega,p_centre) then raise exception 'Accès client refusé' using errcode='42501';end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 5000 then raise exception 'Commentaire requis (5 000 caractères maximum)';end if;
 if not exists(select 1 from public.be_contracts where mega_id=p_mega and centre=p_centre) and not exists(select 1 from public.be_sale_entries where mega_id=p_mega and centre=p_centre) then raise exception 'Client introuvable';end if;
 if p_id is null then
  insert into public.be_client_comments(mega_id,centre,author_id,author_name,body) values(p_mega,p_centre,actor.id,actor.full_name,trim(p_body)) returning id into result;
 else
  select * into previous from public.be_client_comments where id=p_id and mega_id=p_mega and centre=p_centre for update;
  if previous.id is null or (previous.author_id<>actor.id and actor.role<>'admin') then raise exception 'Modification du commentaire refusée' using errcode='42501';end if;
  update public.be_client_comments set body=trim(p_body),updated_at=now() where id=previous.id returning id into result;
 end if;
 insert into public.be_comment_history(comment_id,mega_id,centre,editor_id,editor_name,before_body,after_body) values(result,p_mega,p_centre,actor.id,actor.full_name,previous.body,trim(p_body));
 return result;
end $$;
revoke all on function private.be_save_comment(uuid,text,text,text) from public,anon;
grant execute on function private.be_save_comment(uuid,text,text,text) to authenticated;
create function public.be_save_comment(p_id uuid,p_mega text,p_centre text,p_body text) returns uuid language sql security invoker set search_path='' as $$select private.be_save_comment(p_id,p_mega,p_centre,p_body)$$;
revoke all on function public.be_save_comment(uuid,text,text,text) from public,anon;
grant execute on function public.be_save_comment(uuid,text,text,text) to authenticated;

create function private.be_encode_sale(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.profiles; membership public.be_access; result uuid; client_id text; energy_value text; comment_body text;
begin
 select * into actor from public.profiles where id=auth.uid() and is_active and role='be_agent' and not must_change_password;
 select * into membership from public.be_access where user_id=actor.id and is_active and agent_ref is not null;
 if actor.id is null or membership.user_id is null then raise exception 'Accès encodage refusé' using errcode='42501';end if;
 client_id:=trim(p_data->>'mega_id');energy_value:=p_data->>'energy';comment_body:=trim(coalesce(p_data->>'comment',''));
 -- Never let an agent claim a sale already attributed to another agent or centre.
 if exists(select 1 from public.be_contracts c where c.mega_id=client_id and c.energy=energy_value and (c.centre<>membership.centre or lower(trim(c.agent))<>lower(trim(membership.agent_ref)))) then raise exception 'Vente déjà attribuée à un autre agent ou centre';end if;
 if exists(select 1 from public.be_contracts c where c.mega_id=client_id and c.energy=energy_value and coalesce(p_data->>'ean','')<>'' and c.ean is not null and c.ean<>p_data->>'ean') then raise exception 'EAN différent du reporting MEGA';end if;
 if length(comment_body)>5000 then raise exception 'Commentaire trop long';end if;
 insert into public.be_sale_entries(owner_id,owner_name,agent_ref,centre,mega_id,energy,ean,contract_reference,first_name,last_name,phone,email,product)
 values(actor.id,actor.full_name,membership.agent_ref,membership.centre,client_id,energy_value,trim(coalesce(p_data->>'ean','')),left(trim(coalesce(p_data->>'contract_reference','')),100),trim(p_data->>'first_name'),trim(p_data->>'last_name'),trim(p_data->>'phone'),lower(trim(p_data->>'email')),trim(coalesce(p_data->>'product',''))) returning id into result;
 if comment_body<>'' then perform private.be_save_comment(null,client_id,membership.centre,comment_body);end if;
 return result;
end $$;
revoke all on function private.be_encode_sale(jsonb) from public,anon;
grant execute on function private.be_encode_sale(jsonb) to authenticated;
create function public.be_encode_sale(p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select private.be_encode_sale(p_data)$$;
revoke all on function public.be_encode_sale(jsonb) from public,anon;
grant execute on function public.be_encode_sale(jsonb) to authenticated;

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
 ), matched as (
 select s.*, (select min(c.key) from public.be_contracts c where c.mega_id=s.mega_id and c.energy=s.energy and c.centre=s.centre and lower(trim(c.agent))=lower(trim(s.agent_ref)) and (s.ean='' or s.ean=c.ean) having count(*)=1) as match_key from visible_entries s
 ), displayed as (
 select c.value || coalesce((select jsonb_build_object('owner_id',s.owner_id,'owner_name',s.owner_name,'entry_id',s.id,'encoded_at',s.created_at,'email',s.email,'phone',s.phone) from matched s where s.match_key=c.value->>'key'),'{}'::jsonb) as item from jsonb_array_elements(result->'contracts') c
 union all
 select jsonb_build_object('key','SAISIE:'||s.id,'supplier','MEGA','mega_id',s.mega_id,'ean',s.ean,'energy',s.energy,'agent',s.agent_ref,'agent_reference',s.agent_ref,'centre',s.centre,'status','Signé','status_class','Signé','report_date',(s.created_at at time zone 'Europe/Paris')::date,'reference',s.contract_reference,'client',s.last_name||' '||s.first_name,'phone',s.phone,'email',s.email,'product',s.product,'registered_date',(s.created_at at time zone 'Europe/Paris')::date,'effect_date',null,'period',null,'period_confirmed',false,'clawback_end',null,'owner_id',s.owner_id,'owner_name',s.owner_name,'entry_id',s.id,'encoded_at',s.created_at,'reconciliation',case when exists(select 1 from public.be_contracts c where c.mega_id=s.mega_id and c.energy=s.energy) then 'À vérifier' else 'En attente MEGA' end) from matched s where s.match_key is null
 ) select jsonb_set(result,'{contracts}',coalesce((select jsonb_agg(item order by item->>'key') from displayed),'[]'::jsonb)) into result;
 return result||jsonb_build_object('encoding',case when reader_role='be_agent' then (select jsonb_build_object('centre',centre,'agent_ref',agent_ref) from public.be_access where user_id=auth.uid() and is_active and agent_ref is not null) else null end);
end $$;
