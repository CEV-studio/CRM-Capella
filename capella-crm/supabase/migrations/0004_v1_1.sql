-- ================================================================
--  CAPELLA ENERGY — CRM : LOT v1.1
--  Migration 0004
-- ================================================================
--  - CAR Électricité / CAR Gaz à la place de Puissance
--  - Nom et Prénom séparés
--  - Corbeille récupérable (deleted_at)
--  - Permissions par personne (export / voir tous / gérer l'équipe)
--  - Pièces jointes ACD & Facture (Supabase Storage)
--
--  À exécuter dans Supabase > SQL Editor, APRÈS 0001, 0002, 0003.
--  Peut être relancée sans danger (idempotente autant que possible).
-- ================================================================


-- ----------------------------------------------------------------
-- 1. CHAMPS DES PROSPECTS ET AFFAIRES
-- ----------------------------------------------------------------

-- Prospects : CAR à la place de Puissance, Nom/Prénom séparés, corbeille.
alter table public.prospects add column if not exists nom             text;
alter table public.prospects add column if not exists prenom          text;
alter table public.prospects add column if not exists car_electricite numeric(12,3);
alter table public.prospects add column if not exists car_gaz         numeric(12,3);
alter table public.prospects add column if not exists deleted_at      timestamptz;

-- Reprise de l'existant éventuel (base normalement vide, mais sûr) :
-- on ne perd rien si des données étaient déjà présentes. Le bloc n'agit que
-- si l'ancienne colonne existe encore, pour que la migration soit rejouable.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='prospects' and column_name='nom_prenom') then
    update public.prospects set nom = nom_prenom where nom is null and nom_prenom is not null;
  end if;
end $$;

alter table public.prospects drop column if exists nom_prenom;
alter table public.prospects drop column if exists puissance;

-- Affaires : Nom/Prénom séparés, corbeille.
alter table public.affaires add column if not exists nom        text;
alter table public.affaires add column if not exists prenom     text;
alter table public.affaires add column if not exists deleted_at timestamptz;

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='affaires' and column_name='nom_prenom') then
    update public.affaires set nom = nom_prenom where nom is null and nom_prenom is not null;
  end if;
end $$;

alter table public.affaires drop column if exists nom_prenom;

-- Index : ne parcourir que les lignes vivantes (corbeille exclue).
create index if not exists idx_prospects_vivants
  on public.prospects(assigned_to) where deleted_at is null;
create index if not exists idx_affaires_vivantes
  on public.affaires(commercial_id) where deleted_at is null;


-- ----------------------------------------------------------------
-- 2. PERMISSIONS PAR PERSONNE
-- ----------------------------------------------------------------

alter table public.profiles add column if not exists can_export      boolean not null default false;
alter table public.profiles add column if not exists can_view_all    boolean not null default false;
alter table public.profiles add column if not exists can_manage_team boolean not null default false;

-- Voit les données de toute l'équipe (admin, ou droit accordé).
create or replace function public.can_view_all()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' or can_view_all
       from public.profiles where id = auth.uid() and is_active),
    false
  );
$$;

-- Peut gérer l'équipe : créer des comptes, attribuer, corbeille, tout voir.
-- Équivaut fonctionnellement à l'admin.
create or replace function public.can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' or can_manage_team
       from public.profiles where id = auth.uid() and is_active),
    false
  );
$$;

revoke execute on function public.can_view_all() from public;
grant  execute on function public.can_view_all() to authenticated;
revoke execute on function public.can_manage() from public;
grant  execute on function public.can_manage() to authenticated;

-- Un non-admin ne peut pas s'auto-octroyer une permission : on fige les trois
-- nouvelles colonnes en plus du rôle, du taux et de l'activation.
create or replace function public.tg_protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() NULL = clé de service / migration : rien à brider.
  -- can_manage() couvre l'admin ET les comptes « gérer l'équipe ».
  if auth.uid() is null or public.can_manage() then
    return new;
  end if;
  new.role            := old.role;
  new.commission_rate := old.commission_rate;
  new.is_active       := old.is_active;
  new.can_export      := old.can_export;
  new.can_view_all    := old.can_view_all;
  new.can_manage_team := old.can_manage_team;
  return new;
end;
$$;


-- ----------------------------------------------------------------
-- 3. RLS : ÉLARGIR ADMIN -> « GÉRER L'ÉQUIPE » ET « VOIR TOUS »
-- ----------------------------------------------------------------
-- On remplace les politiques « admin » par des politiques basées sur
-- can_manage(), et on ajoute la lecture élargie can_view_all().

drop policy if exists prospects_admin_all  on public.prospects;
drop policy if exists prospects_select_own on public.prospects;
drop policy if exists prospects_manage_all on public.prospects;

create policy prospects_manage_all on public.prospects
  for all to authenticated
  using (public.can_manage())
  with check (public.can_manage());

create policy prospects_select_own on public.prospects
  for select to authenticated
  using (
    public.is_active_user()
    and deleted_at is null
    and (assigned_to = auth.uid() or public.can_view_all())
  );

drop policy if exists affaires_admin_all  on public.affaires;
drop policy if exists affaires_select_own on public.affaires;
drop policy if exists affaires_manage_all on public.affaires;

create policy affaires_manage_all on public.affaires
  for all to authenticated
  using (public.can_manage())
  with check (public.can_manage());

create policy affaires_select_own on public.affaires
  for select to authenticated
  using (
    public.is_active_user()
    and deleted_at is null
    and (commercial_id = auth.uid() or public.can_view_all())
  );

-- Journal, apporteurs, sources : gérables par « gérer l'équipe ».
drop policy if exists lead_assignments_admin_read   on public.lead_assignments;
drop policy if exists lead_assignments_manage_read  on public.lead_assignments;
create policy lead_assignments_manage_read on public.lead_assignments
  for select to authenticated using (public.can_manage());

drop policy if exists apporteurs_admin  on public.apporteurs;
drop policy if exists apporteurs_manage on public.apporteurs;
create policy apporteurs_manage on public.apporteurs
  for all to authenticated using (public.can_manage()) with check (public.can_manage());

drop policy if exists sources_admin  on public.sources;
drop policy if exists sources_manage on public.sources;
create policy sources_manage on public.sources
  for all to authenticated using (public.can_manage()) with check (public.can_manage());


-- ----------------------------------------------------------------
-- 4. PIÈCES JOINTES (ACD & FACTURE)
-- ----------------------------------------------------------------

create table if not exists public.pieces_jointes (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('ACD', 'Facture')),
  prospect_id  uuid references public.prospects(id) on delete cascade,
  affaire_id   uuid references public.affaires(id)  on delete cascade,
  bucket_path  text not null,
  file_name    text not null,
  mime         text,
  taille       int,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  -- Une pièce est rattachée à un prospect OU à une affaire (au moins un).
  constraint pj_cible check (prospect_id is not null or affaire_id is not null)
);

create index if not exists idx_pj_prospect on public.pieces_jointes(prospect_id);
create index if not exists idx_pj_affaire  on public.pieces_jointes(affaire_id);

alter table public.pieces_jointes enable row level security;

-- Une pièce est accessible si l'utilisateur possède le prospect/affaire lié,
-- ou s'il a le droit de tout voir / gérer.
create or replace function public.pj_visible(p_prospect uuid, p_affaire uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_all()
      or exists (select 1 from public.prospects p
                  where p.id = p_prospect and p.assigned_to = auth.uid())
      or exists (select 1 from public.affaires a
                  where a.id = p_affaire and a.commercial_id = auth.uid());
$$;

revoke execute on function public.pj_visible(uuid, uuid) from public;
grant  execute on function public.pj_visible(uuid, uuid) to authenticated;

drop policy if exists pj_select on public.pieces_jointes;
create policy pj_select on public.pieces_jointes
  for select to authenticated
  using (public.pj_visible(prospect_id, affaire_id));

drop policy if exists pj_insert on public.pieces_jointes;
create policy pj_insert on public.pieces_jointes
  for insert to authenticated
  with check (public.pj_visible(prospect_id, affaire_id));

drop policy if exists pj_delete on public.pieces_jointes;
create policy pj_delete on public.pieces_jointes
  for delete to authenticated
  using (public.pj_visible(prospect_id, affaire_id));


-- ----------------------------------------------------------------
-- 5. STOCKAGE DES FICHIERS (bucket privé)
-- ----------------------------------------------------------------
-- Chemins : 'prospects/{prospect_id}/...' ou 'affaires/{affaire_id}/...'.
-- Le bucket est privé : aucun fichier n'est accessible sans URL signée
-- générée côté serveur après vérification du droit.

insert into storage.buckets (id, name, public)
values ('pieces-jointes', 'pieces-jointes', false)
on conflict (id) do nothing;

-- Droit sur un objet Storage = même règle que sur la pièce jointe :
-- on regarde le 1er segment du chemin (prospects/affaires) et l'UUID.
create or replace function public.storage_pj_autorise(nom text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select case split_part(nom, '/', 1)
    when 'prospects' then
      public.can_view_all()
      or exists (select 1 from public.prospects p
                  where p.id = nullif(split_part(nom, '/', 2), '')::uuid
                    and p.assigned_to = auth.uid())
    when 'affaires' then
      public.can_view_all()
      or exists (select 1 from public.affaires a
                  where a.id = nullif(split_part(nom, '/', 2), '')::uuid
                    and a.commercial_id = auth.uid())
    else false
  end;
$$;

revoke execute on function public.storage_pj_autorise(text) from public;
grant  execute on function public.storage_pj_autorise(text) to authenticated;

drop policy if exists pj_objects_select on storage.objects;
create policy pj_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'pieces-jointes' and public.storage_pj_autorise(name));

drop policy if exists pj_objects_insert on storage.objects;
create policy pj_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pieces-jointes' and public.storage_pj_autorise(name));

drop policy if exists pj_objects_delete on storage.objects;
create policy pj_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'pieces-jointes' and public.storage_pj_autorise(name));
