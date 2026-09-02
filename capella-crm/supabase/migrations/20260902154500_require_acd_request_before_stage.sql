create or replace function public.tg_prospect_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.last_action_at := now();
  elsif tg_op = 'INSERT' then
    new.last_action_at := coalesce(new.last_action_at, now());
  end if;

  if new.stage = 'DDF trop éloignée' and new.date_fin_contrat is null then
    raise exception
      'Renseigne d''abord la « Date fin contrat » avant de passer en « DDF trop éloignée ».'
      using errcode = 'check_violation';
  end if;

  if new.stage = 'Demande ACD'
     and (tg_op = 'INSERT' or new.stage is distinct from old.stage)
     and not exists (
       select 1 from public.acd_requests r
       where r.prospect_id = new.id and r.status <> 'annulee'
     ) then
    raise exception
      'Complète et envoie d''abord la demande d''ACD.'
      using errcode = 'check_violation';
  end if;

  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    new.assigned_at := now();
  end if;

  return new;
end;
$$;
