alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','commercial','apporteur','qualite','be_centre','be_agent'));
alter table public.profiles drop constraint quality_private;
alter table public.profiles add constraint quality_private check(role not in ('qualite','be_centre','be_agent') or (not can_export and not can_view_all and not can_manage_team and commission_rate=0));
create table public.be_access(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 centre text not null check(length(trim(centre))>0),
 agent_ref text check(agent_ref is null or length(trim(agent_ref))>0),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.be_access enable row level security;
create policy admin_only on public.be_access for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
grant select,insert,update,delete on public.be_access to authenticated;
-- Existing broad CRM policies must never grant centre/agent accounts access.
do $$declare p record;begin
 for p in select schemaname,tablename,policyname from pg_policies where policyname in ('quality_deny_direct','quality_deny_storage') loop
 execute format('alter policy %I on %I.%I using ((select public.current_role_name()) not in (''qualite'',''be_centre'',''be_agent'')) with check ((select public.current_role_name()) not in (''qualite'',''be_centre'',''be_agent''))',p.policyname,p.schemaname,p.tablename);
 end loop;
end $$;
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
 return result;
end $$;
-- A confirmed deduction is immutable and references the invoice/credit note used.
create table public.be_deductions(
 id uuid primary key default gen_random_uuid(),
 contract_key text not null references public.be_contracts(key),
 side text not null check(side in ('centre','mega')),
 document_reference text not null check(length(trim(document_reference))>=3),
 applied_at date not null,
 amount_cents integer not null check(amount_cents>0),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(contract_key,side,document_reference)
);
alter table public.be_deductions enable row level security;
create policy admin_select on public.be_deductions for select to authenticated using((select public.is_admin()));
grant select on public.be_deductions to authenticated;
revoke insert,update,delete on public.be_deductions from authenticated;
create or replace function private.be_record_deduction(p_key text,p_side text,p_reference text,p_date date,p_amount integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.be_contracts; t public.be_cycle_tracking; s public.be_statement_lines; due integer; done integer; months integer:=0; i integer; result uuid;
begin
 if not public.is_admin() then raise exception 'Accès comptabilité refusé' using errcode='42501';end if;
 if p_side not in ('centre','mega') or p_side is null or p_date is null or p_date>current_date or p_amount is null or p_amount<=0 or length(trim(coalesce(p_reference,'')))<3 then raise exception 'Déduction invalide';end if;
 select * into c from public.be_contracts where key=p_key for update;
 select * into t from public.be_cycle_tracking where contract_key=p_key for update;
 select * into s from public.be_statement_lines where contract_key=p_key and gross_cents>0 order by period limit 1;
 if c.key is null or s.id is null or t.effect_date is null or t.termination_date is null or t.termination_date<t.effect_date or t.termination_date>= (t.effect_date+interval '3 months')::date or p_date<t.termination_date then raise exception 'Clawback commissionné et dates confirmées requis';end if;
 for i in 1..3 loop if (t.effect_date+make_interval(months=>i))::date<=t.termination_date then months:=i;end if;end loop;
 due:=round((case when p_side='centre' then s.centre_cents else s.gross_cents end)::numeric*(3-months)/3)::integer;
 select greatest(coalesce(sum(amount_cents),0),case when p_side='centre' then t.centre_recovered_cents else t.mega_recovered_cents end) into done from public.be_deductions where contract_key=p_key and side=p_side;
 if p_amount>due-coalesce(done,0) then raise exception 'Montant supérieur au solde à déduire';end if;
 insert into public.be_deductions(contract_key,side,document_reference,applied_at,amount_cents,created_by) values(p_key,p_side,trim(p_reference),p_date,p_amount,auth.uid()) returning id into result;
 update public.be_cycle_tracking set centre_recovered_cents=case when p_side='centre' then greatest(coalesce(centre_recovered_cents,0),coalesce(done,0))+p_amount else centre_recovered_cents end, mega_recovered_cents=case when p_side='mega' then greatest(coalesce(mega_recovered_cents,0),coalesce(done,0))+p_amount else mega_recovered_cents end,updated_at=now() where contract_key=p_key;
 return result;
end $$;
revoke all on function private.be_record_deduction(text,text,text,date,integer) from public,anon;
grant execute on function private.be_record_deduction(text,text,text,date,integer) to authenticated;
create function public.be_record_deduction(p_key text,p_side text,p_reference text,p_date date,p_amount integer) returns uuid language sql security invoker set search_path='' as $$select private.be_record_deduction(p_key,p_side,p_reference,p_date,p_amount)$$;
revoke all on function public.be_record_deduction(text,text,text,date,integer) from public,anon;
grant execute on function public.be_record_deduction(text,text,text,date,integer) to authenticated;

create unique index be_deductions_document_unique on public.be_deductions(contract_key,side,lower(document_reference));

create function public.be_guard_deduction_tracking() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.centre_recovered_cents < coalesce((select sum(amount_cents) from public.be_deductions where contract_key=new.contract_key and side='centre'),0) or new.mega_recovered_cents < coalesce((select sum(amount_cents) from public.be_deductions where contract_key=new.contract_key and side='mega'),0) then raise exception 'Les déductions confirmées ne peuvent pas être effacées du suivi';end if;
 return new;
end $$;
create trigger be_guard_deduction_tracking before update on public.be_cycle_tracking for each row execute function public.be_guard_deduction_tracking();
