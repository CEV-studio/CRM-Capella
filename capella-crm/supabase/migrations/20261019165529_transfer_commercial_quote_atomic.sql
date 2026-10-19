-- Move a commercial's prospect into the quotation workflow as one database
-- transaction. A failed affaire insert must leave the prospect in its prior
-- stage; retries must reuse an existing linked affaire.
create or replace function public.transfer_prospect_to_quote(p_prospect_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_prospect public.prospects%rowtype;
  v_affaire_id uuid;
begin
  if auth.uid() is null or not public.is_active_user()
     or public.current_role_name() not in ('admin', 'commercial') then
    raise exception 'Accès refusé';
  end if;

  select p.* into v_prospect
  from public.prospects as p
  where p.id = p_prospect_id and p.deleted_at is null
  for update;

  if not found then
    raise exception 'Prospect introuvable ou inaccessible';
  end if;

  select a.id into v_affaire_id
  from public.affaires as a
  where a.prospect_id = v_prospect.id and a.deleted_at is null
  order by a.created_at desc
  limit 1;

  if v_affaire_id is null then
    insert into public.affaires (
      commercial_id, prospect_id, source_id, raison_sociale, siren,
      nom, prenom, mail, telephone, type_energie, pdl_elec, pce_gaz,
      fournisseur, date_echeance, sans_engagement, notes, stage, created_by
    ) values (
      coalesce(v_prospect.assigned_to, auth.uid()), v_prospect.id,
      v_prospect.source_id,
      coalesce(v_prospect.raison_sociale,
        nullif(concat_ws(' ', v_prospect.prenom, v_prospect.nom), ''),
        '(sans nom)'),
      v_prospect.siren, v_prospect.nom, v_prospect.prenom, v_prospect.mail,
      coalesce(v_prospect.tel_mobile, v_prospect.tel_fixe),
      case
        when v_prospect.pdl is not null and v_prospect.pce is not null then 'Élec+Gaz'
        when v_prospect.pdl is not null then 'Électricité'
        when v_prospect.pce is not null then 'Gaz'
        else null
      end,
      v_prospect.pdl, v_prospect.pce,
      coalesce(v_prospect.fournisseur_electricite, v_prospect.fournisseur_gaz),
      v_prospect.date_fin_contrat, v_prospect.sans_engagement,
      v_prospect.notes, 'Demande de cotation', auth.uid()
    ) returning id into v_affaire_id;
  end if;

  update public.prospects
  set stage = 'Demande de cotation',
      entered_conversion_at = coalesce(entered_conversion_at, now())
  where id = v_prospect.id;

  return v_affaire_id;
end;
$function$;

revoke all on function public.transfer_prospect_to_quote(uuid) from public, anon;
grant execute on function public.transfer_prospect_to_quote(uuid) to authenticated;
