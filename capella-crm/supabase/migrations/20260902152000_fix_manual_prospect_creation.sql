create or replace function public.tg_create_prospect_entreprise()
returns trigger
language plpgsql
set search_path = public
as $$
declare new_entreprise_id uuid := gen_random_uuid();
begin
  if new.entreprise_id is null then
    insert into public.entreprises (id, raison_sociale, siren, adresse, code_postal, ville, legacy_prospect_id)
    values (
      new_entreprise_id,
      coalesce(nullif(new.raison_sociale, ''), nullif(concat_ws(' ', new.prenom, new.nom), ''), 'Entreprise à compléter'),
      new.siren,
      new.adresse_entreprise,
      new.code_postal,
      new.ville,
      new.id
    );
    update public.prospects set entreprise_id = new_entreprise_id where id = new.id;
  end if;
  return new;
end;
$$;
