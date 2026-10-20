-- Production belge isolée du courtage français. Montants en centimes.
create table public.be_imports (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('report','statement','migration')),
 source text not null, report_date date not null, fingerprint text not null unique,
 row_count integer not null, created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table public.be_contracts (
 key text primary key, supplier text not null default 'MEGA', mega_id text not null, ean text check(ean ~ '^[0-9]{18}$'), energy text not null,
 agent text not null, centre text not null check(centre in ('TILIRA','Cimsourse')),
 status text not null, status_class text not null, report_date date not null,
 data jsonb not null, import_id uuid not null references public.be_imports(id),
 check (lower(regexp_replace(agent,'[^a-zA-Z]','','g')) <> 'houssamterazi' or centre = 'Cimsourse'),
 unique(supplier,mega_id,ean,energy)
);
create index be_contracts_period on public.be_contracts ((data->>'period'),centre);
create index be_contracts_status on public.be_contracts(status_class);
create table public.be_contract_history (
 id bigint generated always as identity primary key, contract_key text not null references public.be_contracts(key),
 import_id uuid not null references public.be_imports(id), before_data jsonb, after_data jsonb not null, created_at timestamptz not null default now()
);
create index be_history_key on public.be_contract_history(contract_key,id desc);
create index be_history_import on public.be_contract_history(import_id);
create table public.be_statement_lines (
 id uuid primary key default gen_random_uuid(), supplier text not null, period date not null check(extract(day from period)=1),
 contract_key text not null references public.be_contracts(key), gross_cents integer not null, centre_cents integer not null,
 data jsonb not null, import_id uuid not null references public.be_imports(id),
 unique(supplier,period,contract_key)
);
create index be_statements_contract on public.be_statement_lines(contract_key);
create index be_statements_import on public.be_statement_lines(import_id);
create table public.be_invoices (
 id uuid primary key default gen_random_uuid(), supplier text not null, centre text not null check(centre in ('TILIRA','Cimsourse')),
 period date not null check(extract(day from period)=1), reference text not null unique,
 amount_cents integer not null, lines jsonb not null, state text not null default 'Établie' check(state in ('Établie','Émise','Payée')),
 issued_at date, paid_at date, created_at timestamptz not null default now(),
 unique(supplier,centre,period), check(state <> 'Payée' or (paid_at is not null and issued_at is not null)),
 check(state <> 'Émise' or issued_at is not null)
);

-- Aucun rôle centre n'est ouvert dans cette première version.
do $$ declare t text; begin
 foreach t in array array['be_imports','be_contracts','be_contract_history','be_statement_lines','be_invoices'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select, insert, update on public.%I to authenticated',t);
 execute format('create policy admin_only on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',t);
 end loop;
end $$;
grant usage on sequence public.be_contract_history_id_seq to authenticated;

create function public.be_import(p_kind text, p_source text, p_date date, p_fingerprint text, p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare batch uuid; r jsonb; old public.be_contracts; k text; n integer:=0; changed integer:=0; same integer:=0; begin
 if not public.is_admin() then raise exception 'Accès administrateur requis'; end if;
 if p_kind not in ('report','migration','statement') or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>10000 then raise exception 'Import vide ou invalide'; end if;
 -- Serialize imports to prevent concurrent duplicates or stale previews.
 perform pg_advisory_xact_lock(620261020);
 if exists(select 1 from public.be_imports where fingerprint=p_fingerprint) then raise exception 'Ce fichier a déjà été importé'; end if;
 insert into public.be_imports(kind,source,report_date,fingerprint,row_count,created_by) values(p_kind,p_source,p_date,p_fingerprint,jsonb_array_length(p_rows),auth.uid()) returning id into batch;
 for r in select value from jsonb_array_elements(p_rows) loop
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
end $$;
revoke all on function public.be_import(text,text,date,text,jsonb) from public,anon;
grant execute on function public.be_import(text,text,date,text,jsonb) to authenticated;

create function public.be_create_invoice(p_centre text,p_period date,p_reference text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid; snapshot jsonb; total integer; begin
 if not public.is_admin() then raise exception 'Accès administrateur requis'; end if;
 if length(trim(p_reference))<3 then raise exception 'Référence obligatoire'; end if;
 select jsonb_agg(jsonb_build_object('key',c.key,'client',c.data->>'client','agent',c.agent,'ean',c.ean,'status',s.data->>'status','gross_cents',s.gross_cents,'centre_cents',s.centre_cents) order by c.key),sum(s.centre_cents)
 into snapshot,total from public.be_statement_lines s join public.be_contracts c on c.key=s.contract_key where c.centre=p_centre and s.period=p_period and s.supplier='MEGA';
 if snapshot is null then raise exception 'Aucun appel fournisseur validé pour cette période et ce centre'; end if;
 insert into public.be_invoices(supplier,centre,period,reference,amount_cents,lines) values('MEGA',p_centre,p_period,trim(p_reference),total,snapshot) returning id into result;
 return result;
end $$;
revoke all on function public.be_create_invoice(text,date,text) from public,anon;
grant execute on function public.be_create_invoice(text,date,text) to authenticated;
-- Les pièces validées ne sont pas modifiées par les reportings.
revoke update on public.be_statement_lines,public.be_imports,public.be_contract_history from authenticated;
revoke update on public.be_invoices from authenticated;
grant update(state,issued_at,paid_at) on public.be_invoices to authenticated;
