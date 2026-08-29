-- Structure relationnelle durable : un contact peut représenter plusieurs
-- entreprises, chaque entreprise possède plusieurs compteurs et chaque
-- compteur conserve toute la succession de ses contrats.

create table if not exists public.entreprises (
  id uuid primary key default gen_random_uuid(),
  raison_sociale text not null,
  siren text,
  adresse text,
  code_postal text,
  ville text,
  legacy_prospect_id uuid unique references public.prospects(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  prenom text,
  nom text,
  email text,
  telephone text,
  email_norm text generated always as (nullif(lower(trim(email)), '')) stored,
  telephone_norm text generated always as (public.normalize_digits(telephone)) stored,
  legacy_prospect_contact_id uuid unique references public.prospect_contacts(id) on delete restrict,
  legacy_prospect_id uuid unique references public.prospects(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(nullif(trim(prenom), ''), nullif(trim(nom), ''), nullif(trim(email), ''), nullif(trim(telephone), '')) is not null)
);

create table if not exists public.contact_entreprises (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete restrict,
  entreprise_id uuid not null references public.entreprises(id) on delete restrict,
  fonction text,
  is_primary boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, entreprise_id)
);

alter table public.prospects add column if not exists entreprise_id uuid references public.entreprises(id) on delete restrict;
alter table public.prospect_compteurs add column if not exists entreprise_id uuid references public.entreprises(id) on delete restrict;
alter table public.prospect_compteurs add column if not exists archived_at timestamptz;

create table if not exists public.contrats_energie (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete restrict,
  compteur_id uuid references public.prospect_compteurs(id) on delete restrict,
  affaire_id uuid references public.affaires(id) on delete set null,
  contrat_precedent_id uuid references public.contrats_energie(id) on delete restrict,
  fournisseur text not null,
  type_energie text not null check (type_energie in ('electricite', 'gaz')),
  reference_contrat text,
  date_signature date,
  date_debut date not null,
  date_fin date not null,
  prix numeric(14,5),
  unite_prix text check (unite_prix is null or unite_prix in ('EUR/MWh', 'EUR/kWh', 'EUR/mois', 'Autre')),
  details_prix text,
  consommation_mwh numeric(14,3),
  statut text not null default 'signe' check (statut in ('brouillon', 'signe', 'annule')),
  notes text,
  correction_motif text,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_fin >= date_debut)
);

create index if not exists idx_entreprises_siren on public.entreprises (public.normalize_digits(siren)) where siren is not null;
create index if not exists idx_contacts_email on public.crm_contacts(email_norm) where email_norm is not null;
create index if not exists idx_contacts_phone on public.crm_contacts(telephone_norm) where telephone_norm is not null;
create index if not exists idx_contact_entreprises_contact on public.contact_entreprises(contact_id) where archived_at is null;
create index if not exists idx_contact_entreprises_entreprise on public.contact_entreprises(entreprise_id) where archived_at is null;
create index if not exists idx_prospects_entreprise on public.prospects(entreprise_id) where deleted_at is null;
create index if not exists idx_compteurs_entreprise on public.prospect_compteurs(entreprise_id) where archived_at is null;
create index if not exists idx_contrats_compteur_dates on public.contrats_energie(compteur_id, date_debut, date_fin) where archived_at is null;
create index if not exists idx_contrats_entreprise on public.contrats_energie(entreprise_id) where archived_at is null;

-- Reprise sans perte des entreprises, contacts et compteurs déjà présents.
insert into public.entreprises (raison_sociale, siren, adresse, code_postal, ville, legacy_prospect_id)
select coalesce(nullif(p.raison_sociale, ''), nullif(concat_ws(' ', p.prenom, p.nom), ''), 'Entreprise à compléter'),
       p.siren, p.adresse_entreprise, p.code_postal, p.ville, p.id
from public.prospects p
where p.deleted_at is null
on conflict (legacy_prospect_id) do nothing;

update public.prospects p set entreprise_id = e.id
from public.entreprises e
where e.legacy_prospect_id = p.id and p.entreprise_id is null;

update public.prospect_compteurs c set entreprise_id = p.entreprise_id
from public.prospects p
where p.id = c.prospect_id and c.entreprise_id is null;

insert into public.crm_contacts (prenom, nom, email, telephone, legacy_prospect_contact_id)
select pc.prenom, pc.nom, pc.email, pc.telephone, pc.id
from public.prospect_contacts pc
on conflict (legacy_prospect_contact_id) do nothing;

insert into public.contact_entreprises (contact_id, entreprise_id, fonction, is_primary)
select c.id, p.entreprise_id, pc.fonction, pc.is_primary
from public.prospect_contacts pc
join public.crm_contacts c on c.legacy_prospect_contact_id = pc.id
join public.prospects p on p.id = pc.prospect_id
where p.entreprise_id is not null
on conflict (contact_id, entreprise_id) do nothing;

insert into public.crm_contacts (prenom, nom, email, telephone, legacy_prospect_id)
select p.prenom, p.nom, p.mail, coalesce(p.tel_mobile, p.tel_fixe), p.id
from public.prospects p
where p.deleted_at is null
  and coalesce(nullif(trim(p.prenom), ''), nullif(trim(p.nom), ''), nullif(trim(p.mail), ''), nullif(trim(coalesce(p.tel_mobile, p.tel_fixe)), '')) is not null
on conflict (legacy_prospect_id) do nothing;

insert into public.contact_entreprises (contact_id, entreprise_id, is_primary)
select c.id, p.entreprise_id, true
from public.crm_contacts c
join public.prospects p on p.id = c.legacy_prospect_id
where p.entreprise_id is not null
on conflict (contact_id, entreprise_id) do nothing;

-- Les anciennes affaires deviennent des contrats historiques quand un point
-- de livraison et des dates exploitables sont connus. Elles restent aussi
-- intactes dans public.affaires.
insert into public.contrats_energie (
  entreprise_id, compteur_id, affaire_id, fournisseur, type_energie,
  reference_contrat, date_signature, date_debut, date_fin,
  consommation_mwh, statut, created_by
)
select p.entreprise_id,
       c.id,
       a.id,
       coalesce(nullif(a.fournisseur, ''), 'Fournisseur à compléter'),
       case when a.type_energie = 'Gaz' then 'gaz' else 'electricite' end,
       a.contrat,
       a.date_signature,
       a.date_debut,
       a.date_echeance,
       a.car_mwh,
       case when a.stage = 'KO' then 'annule' when a.stage = 'Signé' then 'signe' else 'brouillon' end,
       a.created_by
from public.affaires a
join public.prospects p on p.id = a.prospect_id
left join public.prospect_compteurs c on c.prospect_id = p.id
  and ((a.type_energie = 'Gaz' and c.type_energie = 'gaz' and (a.pce_gaz is null or c.numero = a.pce_gaz))
    or (coalesce(a.type_energie, 'Électricité') <> 'Gaz' and c.type_energie = 'electricite' and (a.pdl_elec is null or c.numero = a.pdl_elec)))
where a.deleted_at is null and p.entreprise_id is not null
  and a.date_debut is not null and a.date_echeance is not null
  and not exists (select 1 from public.contrats_energie ce where ce.affaire_id = a.id)
on conflict do nothing;

create or replace function public.prevent_crm_history_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Suppression interdite : archivez cet élément pour préserver l''historique.';
end;
$$;

drop trigger if exists trg_no_delete_entreprises on public.entreprises;
create trigger trg_no_delete_entreprises before delete on public.entreprises for each row execute function public.prevent_crm_history_delete();
drop trigger if exists trg_no_delete_crm_contacts on public.crm_contacts;
create trigger trg_no_delete_crm_contacts before delete on public.crm_contacts for each row execute function public.prevent_crm_history_delete();
drop trigger if exists trg_no_delete_contact_entreprises on public.contact_entreprises;
create trigger trg_no_delete_contact_entreprises before delete on public.contact_entreprises for each row execute function public.prevent_crm_history_delete();
drop trigger if exists trg_no_delete_contrats on public.contrats_energie;
create trigger trg_no_delete_contrats before delete on public.contrats_energie for each row execute function public.prevent_crm_history_delete();

create trigger trg_entreprises_updated_at before update on public.entreprises for each row execute function public.tg_dossier_updated_at();
create trigger trg_crm_contacts_updated_at before update on public.crm_contacts for each row execute function public.tg_dossier_updated_at();
create trigger trg_contact_entreprises_updated_at before update on public.contact_entreprises for each row execute function public.tg_dossier_updated_at();
create trigger trg_contrats_energie_updated_at before update on public.contrats_energie for each row execute function public.tg_dossier_updated_at();

create or replace function public.tg_create_prospect_entreprise()
returns trigger language plpgsql set search_path = public as $$
declare new_entreprise_id uuid;
begin
  if new.entreprise_id is null then
    insert into public.entreprises (raison_sociale, siren, adresse, code_postal, ville, legacy_prospect_id)
    values (coalesce(nullif(new.raison_sociale, ''), nullif(concat_ws(' ', new.prenom, new.nom), ''), 'Entreprise à compléter'), new.siren, new.adresse_entreprise, new.code_postal, new.ville, new.id)
    returning id into new_entreprise_id;
    update public.prospects set entreprise_id = new_entreprise_id where id = new.id;
  end if;
  return new;
end;
$$;
create trigger trg_create_prospect_entreprise after insert on public.prospects for each row execute function public.tg_create_prospect_entreprise();

create or replace function public.tg_sync_prospect_entreprise()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.entreprise_id is not null then
    update public.entreprises set
      raison_sociale = coalesce(nullif(new.raison_sociale, ''), raison_sociale),
      siren = new.siren,
      adresse = new.adresse_entreprise,
      code_postal = new.code_postal,
      ville = new.ville
    where id = new.entreprise_id;
  end if;
  return new;
end;
$$;
create trigger trg_sync_prospect_entreprise after update of raison_sociale, siren, adresse_entreprise, code_postal, ville on public.prospects for each row execute function public.tg_sync_prospect_entreprise();

alter table public.entreprises enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.contact_entreprises enable row level security;
alter table public.contrats_energie enable row level security;

create policy entreprises_select on public.entreprises for select to authenticated using (
  exists (select 1 from public.prospects p where p.entreprise_id = entreprises.id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_view_all())))
);
create policy entreprises_insert on public.entreprises for insert to authenticated with check ((select public.is_active_user()));
create policy entreprises_update on public.entreprises for update to authenticated using (
  exists (select 1 from public.prospects p where p.entreprise_id = entreprises.id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
) with check (
  exists (select 1 from public.prospects p where p.entreprise_id = entreprises.id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
);

create policy crm_contacts_select on public.crm_contacts for select to authenticated using (
  exists (select 1 from public.contact_entreprises ce join public.prospects p on p.entreprise_id = ce.entreprise_id where ce.contact_id = crm_contacts.id and ce.archived_at is null and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_view_all())))
);
create policy crm_contacts_insert on public.crm_contacts for insert to authenticated with check ((select public.is_active_user()));
create policy crm_contacts_update on public.crm_contacts for update to authenticated using (
  exists (select 1 from public.contact_entreprises ce join public.prospects p on p.entreprise_id = ce.entreprise_id where ce.contact_id = crm_contacts.id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
) with check ((select public.is_active_user()));

create policy contact_entreprises_select on public.contact_entreprises for select to authenticated using (
  exists (select 1 from public.prospects p where p.entreprise_id = contact_entreprises.entreprise_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_view_all())))
);
create policy contact_entreprises_insert on public.contact_entreprises for insert to authenticated with check (
  exists (select 1 from public.prospects p where p.entreprise_id = contact_entreprises.entreprise_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
);
create policy contact_entreprises_update on public.contact_entreprises for update to authenticated using (
  exists (select 1 from public.prospects p where p.entreprise_id = contact_entreprises.entreprise_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
) with check (
  exists (select 1 from public.prospects p where p.entreprise_id = contact_entreprises.entreprise_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
);

create policy contrats_energie_select on public.contrats_energie for select to authenticated using (
  exists (select 1 from public.prospects p where p.entreprise_id = contrats_energie.entreprise_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_view_all())))
);
create policy contrats_energie_insert on public.contrats_energie for insert to authenticated with check (
  exists (select 1 from public.prospects p where p.entreprise_id = contrats_energie.entreprise_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
);
create policy contrats_energie_update on public.contrats_energie for update to authenticated using (
  exists (select 1 from public.prospects p where p.entreprise_id = contrats_energie.entreprise_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
) with check (
  exists (select 1 from public.prospects p where p.entreprise_id = contrats_energie.entreprise_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
);

grant select, insert, update on table public.entreprises to authenticated;
grant select, insert, update on table public.crm_contacts to authenticated;
grant select, insert, update on table public.contact_entreprises to authenticated;
grant select, insert, update on table public.contrats_energie to authenticated;
