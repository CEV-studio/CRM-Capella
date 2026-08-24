-- ================================================================
--  CAPELLA ENERGY — CRM : SÉCURITÉ (Row Level Security)
--  Migration 0002
-- ================================================================
--  Principe non négociable :
--  un commercial ne peut techniquement PAS lire ni écrire les données
--  d'un autre commercial, même en fabriquant ses propres requêtes.
--  Le filtrage est fait par Postgres, pas par l'application.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. FONCTIONS D'IDENTITÉ
-- ----------------------------------------------------------------
-- SECURITY DEFINER : ces fonctions lisent `profiles` en contournant RLS,
-- ce qui évite une récursion infinie dans les politiques.

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid() and is_active),
    false
  );
$$;

-- Un compte désactivé ne voit plus rien du tout.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_active from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke execute on function public.current_role_name() from public;
grant  execute on function public.current_role_name() to authenticated;
revoke execute on function public.is_admin() from public;
grant  execute on function public.is_admin() to authenticated;
revoke execute on function public.is_active_user() from public;
grant  execute on function public.is_active_user() to authenticated;


-- ----------------------------------------------------------------
-- 2. ACTIVATION DE RLS SUR TOUTES LES TABLES
-- ----------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.prospects        enable row level security;
alter table public.affaires         enable row level security;
alter table public.apporteurs       enable row level security;
alter table public.sources          enable row level security;
alter table public.fournisseurs     enable row level security;
alter table public.prospect_stages  enable row level security;
alter table public.affaire_stages   enable row level security;
alter table public.lead_assignments enable row level security;

-- Personne n'accède aux tables sans être authentifié.
revoke all on all tables in schema public from anon;


-- ----------------------------------------------------------------
-- 3. PROFILS
-- ----------------------------------------------------------------
-- Un commercial voit sa propre fiche. L'admin voit et gère tout le monde.
-- Un commercial ne peut jamais changer son rôle ni son taux de commission :
-- ces deux colonnes sont verrouillées par un trigger (RLS ne filtre pas par colonne).

create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.tg_protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() est NULL côté serveur (clé de service, migrations, scripts
  -- d'administration) : dans ce contexte il n'y a pas d'utilisateur à brider.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  -- Un non-admin ne peut modifier ni son rôle, ni son taux, ni son activation.
  new.role            := old.role;
  new.commission_rate := old.commission_rate;
  new.is_active       := old.is_active;
  return new;
end;
$$;

create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.tg_protect_profile_privileges();


-- ----------------------------------------------------------------
-- 4. PROSPECTS — le cœur de l'isolation
-- ----------------------------------------------------------------
-- Commercial : uniquement les prospects qui lui sont attribués.
-- Réservoir (assigned_to IS NULL) : admin uniquement.
-- Un commercial ne peut ni s'attribuer un lead, ni en céder un :
-- le WITH CHECK impose que la ligne reste la sienne après écriture.

create policy prospects_admin_all on public.prospects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy prospects_select_own on public.prospects
  for select to authenticated
  using (public.is_active_user() and assigned_to = auth.uid());

create policy prospects_update_own on public.prospects
  for update to authenticated
  using (public.is_active_user() and assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

create policy prospects_insert_own on public.prospects
  for insert to authenticated
  with check (public.is_active_user() and assigned_to = auth.uid());

-- Volontairement : PAS de policy DELETE pour les commerciaux.
-- Seul l'admin peut supprimer (via prospects_admin_all).


-- ----------------------------------------------------------------
-- 5. AFFAIRES
-- ----------------------------------------------------------------

create policy affaires_admin_all on public.affaires
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy affaires_select_own on public.affaires
  for select to authenticated
  using (public.is_active_user() and commercial_id = auth.uid());

create policy affaires_update_own on public.affaires
  for update to authenticated
  using (public.is_active_user() and commercial_id = auth.uid())
  with check (commercial_id = auth.uid());

create policy affaires_insert_own on public.affaires
  for insert to authenticated
  with check (public.is_active_user() and commercial_id = auth.uid());


-- ----------------------------------------------------------------
-- 6. HISTORIQUE D'ATTRIBUTION
-- ----------------------------------------------------------------
-- Lecture réservée à l'admin (c'est un journal de pilotage).
-- L'écriture passe uniquement par le trigger (SECURITY DEFINER).

create policy lead_assignments_admin_read on public.lead_assignments
  for select to authenticated
  using (public.is_admin());


-- ----------------------------------------------------------------
-- 7. RÉFÉRENTIELS — lecture pour tous, écriture pour l'admin
-- ----------------------------------------------------------------

create policy stages_prospect_read on public.prospect_stages
  for select to authenticated using (public.is_active_user());
create policy stages_prospect_admin on public.prospect_stages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy stages_affaire_read on public.affaire_stages
  for select to authenticated using (public.is_active_user());
create policy stages_affaire_admin on public.affaire_stages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy fournisseurs_read on public.fournisseurs
  for select to authenticated using (public.is_active_user());
create policy fournisseurs_admin on public.fournisseurs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy sources_read on public.sources
  for select to authenticated using (public.is_active_user());
create policy sources_admin on public.sources
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Les apporteurs sont visibles par les commerciaux (ils les sélectionnent
-- sur une affaire) mais leurs taux et statuts de paiement ne sont modifiables
-- que par l'admin.
create policy apporteurs_read on public.apporteurs
  for select to authenticated using (public.is_active_user());
create policy apporteurs_admin on public.apporteurs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ----------------------------------------------------------------
-- 8. CRÉATION AUTOMATIQUE DU PROFIL À L'INSCRIPTION
-- ----------------------------------------------------------------
-- Quand l'admin crée un compte, Supabase Auth crée la ligne dans auth.users.
-- Ce trigger crée le profil correspondant avec les métadonnées transmises.

create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, commission_rate, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'commercial'),
    coalesce((new.raw_user_meta_data->>'commission_rate')::numeric, 0.50),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();
