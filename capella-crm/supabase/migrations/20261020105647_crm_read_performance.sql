-- Read-only endpoints: aggregate in Postgres and transfer only one page.
-- SECURITY INVOKER deliberately retains all existing row-level policies.
create index if not exists idx_prospects_pipeline_recent
  on public.prospects (last_action_at desc nulls last, id)
  where deleted_at is null and became_client_at is null;
create index if not exists idx_prospects_owner_pipeline_recent
  on public.prospects (assigned_to, last_action_at desc nulls last, id)
  where deleted_at is null and became_client_at is null;
create index if not exists idx_prospects_reservoir_recent
  on public.prospects (created_at desc, id)
  where assigned_to is null and deleted_at is null;
create index if not exists idx_prospects_deadline_live
  on public.prospects (date_fin_contrat, id)
  where deleted_at is null and date_fin_contrat is not null;
create index if not exists idx_compteurs_deadline_live
  on public.prospect_compteurs (prospect_id, date_echeance, id)
  where archived_at is null and date_echeance is not null;

create or replace function public.crm_deadlines_page(
  p_period text default 'toutes', p_query text default '', p_page integer default 1
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_all boolean;
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_year date := (v_today + interval '12 months')::date;
  v_eighteen date := (v_today + interval '18 months')::date;
  v_result jsonb;
begin
  select role = 'admin' or can_view_all into v_all from public.profiles
    where id = (select auth.uid()) and is_active and role <> 'apporteur';
  if not found then raise exception 'Accès réservé' using errcode = '42501'; end if;
  if p_period is null or p_period not in ('toutes','retard','0_12','12_18','18_plus') then p_period := 'toutes'; end if;

  with visible_prospects as not materialized (
    select p.id, p.ref, p.raison_sociale, p.nom, p.prenom, p.mail, p.tel_mobile,
      p.tel_fixe, p.stage, p.date_fin_contrat, p.fournisseur_electricite, p.fournisseur_gaz
    from public.prospects p
    where p.deleted_at is null and (v_all or p.assigned_to = (select auth.uid()))
  ), deadlines as (
    select 'meter-' || m.id as key, p.id as prospect_id, m.date_echeance as date,
      case when m.type_energie = 'gaz' then 'Gaz'
        else 'Électricité' || case when coalesce(m.segment,'') <> '' then ' · ' || m.segment else '' end end as kind,
      case when m.type_energie = 'gaz' then 'PCE ' else 'PDL ' end || m.numero as identifier,
      case when m.type_energie = 'gaz' then p.fournisseur_gaz else p.fournisseur_electricite end as supplier
    from public.prospect_compteurs m join visible_prospects p on p.id = m.prospect_id
    where m.archived_at is null and m.date_echeance is not null
    union all
    select 'contract-' || p.id, p.id, p.date_fin_contrat, 'Contrat', null,
      nullif(concat_ws(' / ', nullif(p.fournisseur_electricite,''), nullif(p.fournisseur_gaz,'')), '')
    from visible_prospects p
    where p.date_fin_contrat is not null and not exists (
      select 1 from public.prospect_compteurs m where m.prospect_id = p.id
        and m.archived_at is null and m.date_echeance is not null
    )
  ), searchable as materialized (
    select d.*, coalesce(nullif(p.raison_sociale,''), nullif(concat_ws(' ', nullif(p.prenom,''), nullif(p.nom,'')),''), 'Dossier sans nom') as company_name,
      jsonb_build_object('id',p.id,'ref',p.ref,'raison_sociale',p.raison_sociale,'nom',p.nom,'prenom',p.prenom,'stage',p.stage) as prospect,
      case when d.date < v_today then 'retard' when d.date <= v_year then '0_12'
        when d.date <= v_eighteen then '12_18' else '18_plus' end as period
    from deadlines d join visible_prospects p on p.id = d.prospect_id
    where coalesce(btrim(p_query),'') = '' or strpos(lower(concat_ws(' ',
      coalesce(nullif(p.raison_sociale,''),nullif(concat_ws(' ',p.prenom,p.nom),''),'Dossier sans nom'),
      p.prenom,p.nom,p.mail,p.tel_mobile,p.tel_fixe,p.stage,d.identifier,d.supplier)), lower(left(btrim(p_query),120))) > 0
  ), stats as (
    select count(*) as total,
      count(*) filter(where period = 'retard') as overdue,
      count(*) filter(where period = '0_12') as within_year,
      count(*) filter(where period = '12_18') as within_eighteen,
      count(*) filter(where period = '18_plus') as later,
      count(*) filter(where p_period = 'toutes' or period = p_period) as matching
    from searchable
  ), paging as (
    select *, greatest(1,(matching + 49) / 50) as pages,
      least(greatest(1,coalesce(p_page,1)),greatest(1,(matching + 49) / 50)) as page
    from stats
  ), page_rows as (
    select * from searchable where p_period = 'toutes' or period = p_period
    order by date, company_name, key
    limit 50 offset (select (page - 1) * 50 from paging)
  )
  select jsonb_build_object(
    'counts',jsonb_build_object('toutes',total,'retard',overdue,'alerte',within_year + within_eighteen,
      'zeroDouze',within_year,'douzeDixHuit',within_eighteen,'plusTard',later),
    'total',matching,'page',page,'totalPages',pages,'today',v_today,'eighteenMonths',v_eighteen,
    'rows',coalesce((select jsonb_agg(jsonb_build_object('key',key,'prospect',prospect,'date',date,
      'kind',kind,'identifier',identifier,'supplier',supplier) order by date,company_name,key) from page_rows),'[]'::jsonb)
  ) into v_result from paging;
  return v_result;
end;
$$;

create or replace function public.crm_prospect_summary()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_all boolean;
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_result jsonb;
begin
  select role = 'admin' or can_view_all into v_all from public.profiles
    where id = (select auth.uid()) and is_active and role <> 'apporteur';
  if not found then raise exception 'Accès réservé' using errcode = '42501'; end if;
  with visible as materialized (
    select p.assigned_to, p.stage, p.next_action_date from public.prospects p
    where p.deleted_at is null and (v_all or p.assigned_to = (select auth.uid()))
  ), stages as (
    select stage, count(*) as total from visible group by stage
  ), owners as (
    select assigned_to,
      count(*) filter(where stage not in ('KO','Numéro KO','Pas intéressé','DDF trop éloignée')) as actifs,
      count(*) filter(where next_action_date < v_today and stage not in ('KO','Numéro KO','Pas intéressé','DDF trop éloignée')) as retards
    from visible where assigned_to is not null group by assigned_to
  )
  select jsonb_build_object('stages',coalesce((select jsonb_agg(to_jsonb(stages)) from stages),'[]'::jsonb),
    'owners',coalesce((select jsonb_agg(to_jsonb(owners)) from owners),'[]'::jsonb),
    'upcoming',(select count(*) from visible where next_action_date >= v_today)) into v_result;
  return v_result;
end;
$$;

create or replace function public.crm_reservoir_counts()
returns table(source_id uuid, total bigint)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = (select auth.uid()) and is_active and role = 'admin') then
    raise exception 'Accès réservé' using errcode = '42501';
  end if;
  return query select p.source_id, count(*) from public.prospects p
    where p.assigned_to is null and p.deleted_at is null group by p.source_id;
end;
$$;

revoke all on function public.crm_deadlines_page(text,text,integer) from public, anon;
revoke all on function public.crm_prospect_summary() from public, anon;
revoke all on function public.crm_reservoir_counts() from public, anon;
grant execute on function public.crm_deadlines_page(text,text,integer) to authenticated;
grant execute on function public.crm_prospect_summary() to authenticated;
grant execute on function public.crm_reservoir_counts() to authenticated;
notify pgrst, 'reload schema';
