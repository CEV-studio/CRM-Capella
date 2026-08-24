-- ================================================================
--  CAPELLA ENERGY — CRM : SCHÉMA DE BASE
--  Migration 0001 — tables, contraintes, automatismes métier
-- ================================================================
--  À exécuter dans Supabase > SQL Editor (une seule fois).
-- ================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- 1. UTILITAIRES
-- ----------------------------------------------------------------

-- Met à jour automatiquement la colonne updated_at à chaque écriture.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normalise un numéro de téléphone français pour la détection de doublons :
-- on ne garde que les chiffres, puis les 9 derniers (gomme +33 / 0 / espaces).
create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 9), '');
$$;

-- Normalise un SIREN / PDL / PCE : chiffres uniquement.
create or replace function public.normalize_digits(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), '');
$$;


-- ----------------------------------------------------------------
-- 2. RÉFÉRENTIELS
-- ----------------------------------------------------------------

-- Étapes de PROSPECTION.
-- Les libellés sont conservés à l'identique (les commerciaux les connaissent).
-- La catégorie sert aux filtres et aux KPI, elle n'est jamais affichée telle quelle.
create table public.prospect_stages (
  label       text primary key,
  category    text not null check (category in ('actif', 'a_transferer', 'clos')),
  color       text not null,            -- code couleur du statut (fond de ligne)
  sort_order  int  not null
);

-- Étapes de CONVERSION.
create table public.affaire_stages (
  label       text primary key,
  category    text not null check (category in ('actif', 'gagne', 'perdu')),
  color       text not null,
  sort_order  int  not null
);

-- Fournisseurs mis en concurrence.
create table public.fournisseurs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  is_active   boolean not null default true,
  sort_order  int not null default 0
);

-- Canaux d'acquisition des leads (call centers, apporteurs, fichiers achetés...).
create table public.sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  kind        text not null default 'autre'
                check (kind in ('call_center', 'apporteur', 'fichier', 'web', 'autre')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);


-- ----------------------------------------------------------------
-- 3. UTILISATEURS (commerciaux + admin)
-- ----------------------------------------------------------------
-- Un profil pour chaque compte Supabase Auth.
-- Le rôle porté ici est la seule source de vérité pour les droits.

create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text not null,
  email                 text not null unique,
  role                  text not null default 'commercial'
                          check (role in ('admin', 'commercial')),
  commission_rate       numeric(5,4) not null default 0.50    -- 0.70 = 70 %
                          check (commission_rate >= 0 and commission_rate <= 1),
  is_active             boolean not null default true,
  must_change_password  boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create index idx_profiles_role on public.profiles(role) where is_active;


-- ----------------------------------------------------------------
-- 4. APPORTEURS D'AFFAIRES
-- ----------------------------------------------------------------

create table public.apporteurs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  contact         text,
  commission_rate numeric(5,4) not null default 0
                    check (commission_rate >= 0 and commission_rate <= 1),
  payment_status  text not null default 'À payer'
                    check (payment_status in ('À payer', 'Payé', 'En attente')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_apporteurs_updated_at
  before update on public.apporteurs
  for each row execute function public.tg_set_updated_at();


-- ----------------------------------------------------------------
-- 5. PROSPECTS (réservoir + prospection)
-- ----------------------------------------------------------------
-- assigned_to IS NULL  -> le prospect est dans le RÉSERVOIR (admin seulement)
-- assigned_to = <uuid> -> il appartient à ce commercial, et à lui seul.

create table public.prospects (
  id                  uuid primary key default gen_random_uuid(),
  ref                 text unique,                  -- identifiant lisible : PR-000123

  -- Contact
  nom_prenom          text,
  mail                text,
  tel_mobile          text,
  tel_fixe            text,

  -- Entreprise
  raison_sociale      text,
  siren               text,
  naf                 text,
  code_postal         text,
  nb_sites            int,
  segment             text,

  -- Compteurs / énergie
  pdl                 text,
  pce                 text,
  puissance           text,
  option_tarifaire    text,
  fournisseur_actuel  text,
  date_fin_contrat    date,

  -- Suivi commercial
  stage               text not null default 'NRP'
                        references public.prospect_stages(label) on update cascade,
  next_action         text,
  next_action_date    date,
  notes               text,
  score               int check (score is null or score between 0 and 5),
  last_action_at      timestamptz,

  -- Origine et attribution
  source_id           uuid references public.sources(id) on delete set null,
  assigned_to         uuid references public.profiles(id) on delete set null,
  assigned_at         timestamptz,

  -- Clés de dédoublonnage (calculées, jamais saisies)
  siren_norm          text generated always as (public.normalize_digits(siren)) stored,
  pdl_norm            text generated always as (public.normalize_digits(pdl)) stored,
  pce_norm            text generated always as (public.normalize_digits(pce)) stored,
  mobile_norm         text generated always as (public.normalize_phone(tel_mobile)) stored,

  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_prospects_updated_at
  before update on public.prospects
  for each row execute function public.tg_set_updated_at();

-- Index de travail
create index idx_prospects_assigned  on public.prospects(assigned_to);
create index idx_prospects_reservoir on public.prospects(source_id) where assigned_to is null;
create index idx_prospects_stage     on public.prospects(stage);
create index idx_prospects_next_date on public.prospects(next_action_date);

-- Index de dédoublonnage (volontairement NON uniques :
-- on signale les doublons à l'utilisateur, on ne bloque jamais l'import).
create index idx_prospects_siren_norm  on public.prospects(siren_norm)  where siren_norm  is not null;
create index idx_prospects_pdl_norm    on public.prospects(pdl_norm)    where pdl_norm    is not null;
create index idx_prospects_pce_norm    on public.prospects(pce_norm)    where pce_norm    is not null;
create index idx_prospects_mobile_norm on public.prospects(mobile_norm) where mobile_norm is not null;


-- Numérotation lisible PR-000001
create sequence if not exists public.prospect_ref_seq;

create or replace function public.tg_prospect_ref()
returns trigger
language plpgsql
as $$
begin
  if new.ref is null then
    new.ref := 'PR-' || lpad(nextval('public.prospect_ref_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_prospects_ref
  before insert on public.prospects
  for each row execute function public.tg_prospect_ref();


-- Règles métier de la prospection :
--  * tout changement d'étape horodate « Dernière action »
--  * l'étape « DFF trop éloigné » exige une date de fin de contrat
create or replace function public.tg_prospect_rules()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.last_action_at := now();
  elsif tg_op = 'INSERT' then
    new.last_action_at := coalesce(new.last_action_at, now());
  end if;

  if new.stage = 'DFF trop éloigné' and new.date_fin_contrat is null then
    raise exception
      'Renseigne d''abord la « Date fin contrat » avant de passer en « DFF trop éloigné ».'
      using errcode = 'check_violation';
  end if;

  -- Horodate l'attribution dès qu'un prospect change de propriétaire.
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    new.assigned_at := now();
  end if;

  return new;
end;
$$;

create trigger trg_prospects_rules
  before insert or update on public.prospects
  for each row execute function public.tg_prospect_rules();


-- ----------------------------------------------------------------
-- 6. HISTORIQUE D'ATTRIBUTION (traçabilité + réattribution)
-- ----------------------------------------------------------------

create table public.lead_assignments (
  id           bigserial primary key,
  prospect_id  uuid not null references public.prospects(id) on delete cascade,
  from_user    uuid references public.profiles(id) on delete set null,
  to_user      uuid references public.profiles(id) on delete set null,
  assigned_by  uuid references public.profiles(id) on delete set null,
  reason       text,
  created_at   timestamptz not null default now()
);

create index idx_lead_assignments_prospect on public.lead_assignments(prospect_id);

create or replace function public.tg_log_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.assigned_to is not null then
    insert into public.lead_assignments(prospect_id, from_user, to_user, assigned_by)
    values (new.id, null, new.assigned_to, auth.uid());
  elsif tg_op = 'UPDATE' and new.assigned_to is distinct from old.assigned_to then
    insert into public.lead_assignments(prospect_id, from_user, to_user, assigned_by)
    values (new.id, old.assigned_to, new.assigned_to, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_prospects_log_assignment
  after insert or update of assigned_to on public.prospects
  for each row execute function public.tg_log_assignment();


-- ----------------------------------------------------------------
-- 7. AFFAIRES (conversion)
-- ----------------------------------------------------------------

create table public.affaires (
  id                uuid primary key default gen_random_uuid(),
  ref               text unique,                    -- CAP-000123

  commercial_id     uuid not null references public.profiles(id) on delete restrict,
  apporteur_id      uuid references public.apporteurs(id) on delete set null,
  prospect_id       uuid references public.prospects(id) on delete set null,  -- traçabilité d'origine
  source_id         uuid references public.sources(id) on delete set null,

  raison_sociale    text not null,
  adresse_conso     text,
  siren             text,
  nom_prenom        text,
  mail              text,
  telephone         text,

  fournisseur       text,
  type_energie      text check (type_energie in ('Électricité', 'Gaz', 'Élec+Gaz')),
  contrat           text,
  pdl_elec          text,
  pce_gaz           text,

  stage             text not null default 'Demande de cotation'
                      references public.affaire_stages(label) on update cascade,

  date_debut        date,
  date_echeance     date,
  car_mwh           numeric(12,3),
  date_entree       date not null default current_date,
  date_signature    date,
  date_relance      date,
  commission        numeric(12,2) not null default 0,

  facture           text,        -- lien / référence du document
  acd               text,
  notes             text,

  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_affaires_updated_at
  before update on public.affaires
  for each row execute function public.tg_set_updated_at();

create index idx_affaires_commercial on public.affaires(commercial_id);
create index idx_affaires_stage      on public.affaires(stage);
create index idx_affaires_signature  on public.affaires(date_signature);
create index idx_affaires_apporteur  on public.affaires(apporteur_id);
create index idx_affaires_relance    on public.affaires(date_relance);

create sequence if not exists public.affaire_ref_seq;

create or replace function public.tg_affaire_rules()
returns trigger
language plpgsql
as $$
begin
  if new.ref is null then
    new.ref := 'CAP-' || lpad(nextval('public.affaire_ref_seq')::text, 6, '0');
  end if;

  -- Passage à « Signé » : la date de signature se remplit toute seule si elle est vide.
  if new.stage = 'Signé' and new.date_signature is null then
    new.date_signature := current_date;
  end if;

  return new;
end;
$$;

create trigger trg_affaires_rules
  before insert or update on public.affaires
  for each row execute function public.tg_affaire_rules();
