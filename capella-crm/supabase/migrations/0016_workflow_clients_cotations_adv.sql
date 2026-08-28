alter table public.prospects add column if not exists entered_conversion_at timestamptz;
create index if not exists idx_prospects_entered_conversion_at on public.prospects(entered_conversion_at) where entered_conversion_at is not null;

insert into public.prospect_stages(label, category, color, sort_order, quick_filter)
values ('Demande de cotation', 'a_transferer', '#E3F5EE', 45, false)
on conflict (label) do update set category=excluded.category,color=excluded.color,sort_order=excluded.sort_order;

update public.prospects p set entered_conversion_at=coalesce(p.entered_conversion_at,a.created_at)
from public.affaires a where a.prospect_id=p.id and p.entered_conversion_at is null;

create or replace function public.mark_prospect_client_stage()
returns trigger language plpgsql as $$
begin
  if new.stage in ('Demande ACD','RDV comparatif','Présentation','RIB','Demande de cotation') and new.became_client_at is null then new.became_client_at:=now(); end if;
  if new.stage='Demande de cotation' and new.entered_conversion_at is null then new.entered_conversion_at:=now(); end if;
  return new;
end;
$$;

drop trigger if exists trg_mark_prospect_client_stage on public.prospects;
create trigger trg_mark_prospect_client_stage before insert or update of stage on public.prospects for each row execute function public.mark_prospect_client_stage();
