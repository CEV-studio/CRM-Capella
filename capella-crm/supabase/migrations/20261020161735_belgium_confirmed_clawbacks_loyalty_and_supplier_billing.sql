-- Dates confirmées et suivi financier isolés des snapshots des imports.
create table public.be_cycle_tracking (
 contract_key text primary key references public.be_contracts(key),
 effect_date date, termination_date date, completed_at date,
 bonus_invoiced_at date, bonus_paid_at date,
 centre_recovered_cents integer not null default 0 check(centre_recovered_cents>=0),
 mega_recovered_cents integer not null default 0 check(mega_recovered_cents>=0),
 notes text not null default '',updated_at timestamptz not null default now(),
 check(termination_date is null or effect_date is null or termination_date>=effect_date),
 check(completed_at is null or (effect_date is not null and completed_at>=(effect_date+interval '3 months')::date)),
 check(completed_at is null or termination_date is null or termination_date>=completed_at),
 check(bonus_invoiced_at is null or (effect_date is not null and bonus_invoiced_at>=(effect_date+interval '3 months')::date)),
 check(bonus_paid_at is null or (bonus_invoiced_at is not null and bonus_paid_at>=bonus_invoiced_at))
);
create table public.be_supplier_billing (
 supplier text not null default 'MEGA',period date not null check(extract(day from period)=1),
 call_received_at date,invoiced boolean not null default false,invoiced_at date,
 invoice_reference text,received_cents integer not null default 0 check(received_cents>=0),
 received_at date,notes text not null default '',updated_at timestamptz not null default now(),
 primary key(supplier,period),
 check(invoiced or (invoiced_at is null and received_cents=0 and received_at is null)),
 check(received_cents=0 or received_at is not null),
 check(invoiced_at is null or call_received_at is null or invoiced_at>=call_received_at),
 check(received_at is null or invoiced_at is null or received_at>=invoiced_at)
);
alter table public.be_cycle_tracking enable row level security;
alter table public.be_supplier_billing enable row level security;
revoke all on public.be_cycle_tracking,public.be_supplier_billing from anon,authenticated;
grant select,insert,update on public.be_cycle_tracking,public.be_supplier_billing to authenticated;
create policy admin_only on public.be_cycle_tracking for all to authenticated
 using((select public.is_admin())) with check((select public.is_admin()));
create policy admin_only on public.be_supplier_billing for all to authenticated
 using((select public.is_admin())) with check((select public.is_admin()));
-- Seule la période de septembre est déclarée facturée par l'utilisateur.
-- Référence/date d'émission et encaissement non fournis : ne pas les inventer.
insert into public.be_supplier_billing(supplier,period,call_received_at,invoiced,notes)
select 'MEGA',date '2026-09-01',date '2026-10-15',true,
 'Facturation de septembre confirmée par l’utilisateur le 20/10/2026. Référence/date de facture et encaissement non renseignés.'
where exists(select 1 from public.be_statement_lines where supplier='MEGA' and period=date '2026-09-01');
