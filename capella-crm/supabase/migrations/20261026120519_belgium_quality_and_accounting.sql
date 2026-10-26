-- Quality is read-only and receives only explicitly selected production fields.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','commercial','apporteur','qualite'));
alter table public.profiles add constraint quality_private check(role <> 'qualite' or (not can_export and not can_view_all and not can_manage_team and commission_rate=0));
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create or replace function private.be_production_read() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('admin','qualite')) then raise exception 'Accès production refusé' using errcode='42501';end if;
 select jsonb_build_object(
 'contracts',coalesce((select jsonb_agg(jsonb_build_object(
 'key',c.key,'supplier',c.supplier,'mega_id',c.mega_id,'ean',c.ean,'energy',c.energy,'agent',c.agent,'centre',c.centre,'status',c.status,'status_class',c.status_class,'report_date',c.report_date,
 'reference',c.data->'reference','client',c.data->'client','phone',c.data->'phone','postal_code',c.data->'postal_code','product',c.data->'product','registered_date',c.data->'registered_date','effect_date',c.data->'effect_date','period',c.data->'period','period_confirmed',exists(select 1 from public.be_statement_lines s where s.contract_key=c.key),'clawback_end',c.data->'clawback_end') order by c.key) from public.be_contracts c),'[]'::jsonb),
 'tracking',coalesce((select jsonb_agg(jsonb_build_object('contract_key',t.contract_key,'effect_date',t.effect_date,'termination_date',t.termination_date)) from public.be_cycle_tracking t),'[]'::jsonb),
 'last_report',(select max(report_date) from public.be_contracts)) into result;
 return result;
end $$;
revoke all on function private.be_production_read() from public,anon;
grant execute on function private.be_production_read() to authenticated;
create or replace function public.be_production_read() returns jsonb language sql stable security invoker set search_path='' as $$select private.be_production_read()$$;
revoke all on function public.be_production_read() from public,anon;
grant execute on function public.be_production_read() to authenticated;
-- A restrictive policy prevents quality from reusing broader existing policies.
do $$declare t record;begin
 for t in select tablename from pg_tables where schemaname='public' and tablename<>'profiles' loop
  execute format('create policy quality_deny_direct on public.%I as restrictive for all to authenticated using ((select public.current_role_name()) is distinct from ''qualite'') with check ((select public.current_role_name()) is distinct from ''qualite'')',t.tablename);
 end loop;
end $$;

create policy quality_deny_storage on storage.objects as restrictive for all to authenticated using ((select public.current_role_name()) is distinct from 'qualite') with check ((select public.current_role_name()) is distinct from 'qualite');
