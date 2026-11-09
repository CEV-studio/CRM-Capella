create or replace view public.reservoir_echeances with (security_invoker = true) as
select r.*, least(r.date_fin_contrat, (select min(m.date_echeance) from public.prospect_compteurs m where m.prospect_id=r.id and m.archived_at is null)) as echeance_reservoir
from public.reservoir_disponible r;
grant select on public.reservoir_echeances to authenticated, service_role;