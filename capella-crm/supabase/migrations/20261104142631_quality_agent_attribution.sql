-- Attribute each review to the seller on its linked contract, not the MEGA
-- agent reference used by the call centre. Scores and answers remain intact.
alter table public.quality_reviews add column agent_centre text;

update public.quality_reviews q
set agent_name = trim(c.agent), agent_centre = c.centre
from public.be_contracts c
where q.sale_key = c.key and length(trim(c.agent)) > 0;

create policy quality_read_sales_agents on public.be_sales_agents
for select to authenticated
using ((select public.current_role_name()) = 'qualite');
