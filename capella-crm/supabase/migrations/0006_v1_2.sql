-- ============================================================
--  Migration 0006 — Lot v1.2 (7 améliorations)
-- ============================================================
--  Cette migration regroupe TOUS les changements de base du lot :
--    #1 Fournisseur Élec / Gaz          → colonnes sur prospects
--    #4 Création de sources             → (aucun changement de schéma)
--    #6 Champs personnalisés à l'import → table + colonne de valeurs
--    #7 Optimisation vitesse            → index manquants
--
--  Rejouable sans risque : tout est en « if not exists ».
--  À coller une seule fois dans Supabase → SQL Editor → Run.
-- ============================================================


-- ------------------------------------------------------------
--  #1 — Fournisseur Électricité / Gaz (deux champs séparés)
-- ------------------------------------------------------------
-- On remplace l'unique « fournisseur actuel » par deux colonnes, comme la
-- CAR élec/gaz déjà séparée. La base de prod étant encore vide, aucune
-- donnée n'est perdue.
alter table public.prospects
  add column if not exists fournisseur_electricite text,
  add column if not exists fournisseur_gaz         text;

alter table public.prospects drop column if exists fournisseur_actuel;


-- ------------------------------------------------------------
--  #6 — Champs personnalisés à l'import
-- ------------------------------------------------------------
-- Définitions des champs personnalisés (ex. « Marge souhaitée »). Le libellé
-- est ce que Jeremy tape ; la clé est sa version normalisée, stable, utilisée
-- pour ranger la valeur dans le JSON de chaque prospect.
create table if not exists public.champs_personnalises (
  id         uuid primary key default gen_random_uuid(),
  cle        text not null unique,
  libelle    text not null,
  created_at timestamptz not null default now()
);

alter table public.champs_personnalises enable row level security;

-- Tout le monde (connecté) peut lire les définitions ; seule la gestion
-- d'équipe peut en créer, modifier ou supprimer.
drop policy if exists champs_perso_read on public.champs_personnalises;
create policy champs_perso_read on public.champs_personnalises
  for select to authenticated using (true);

drop policy if exists champs_perso_manage on public.champs_personnalises;
create policy champs_perso_manage on public.champs_personnalises
  for all to authenticated
  using (public.can_manage())
  with check (public.can_manage());

-- Valeurs des champs personnalisés, rangées par clé sur chaque prospect.
alter table public.prospects
  add column if not exists champs_perso jsonb not null default '{}'::jsonb;


-- ------------------------------------------------------------
--  #7 — Index manquants
-- ------------------------------------------------------------
-- Retrouver l'affaire issue d'un prospect (traçabilité, fiches liées).
create index if not exists idx_affaires_prospect
  on public.affaires(prospect_id) where prospect_id is not null;

-- Filtrer/trier les prospects par créateur (journal, imports).
create index if not exists idx_prospects_created_by
  on public.prospects(created_by) where created_by is not null;
