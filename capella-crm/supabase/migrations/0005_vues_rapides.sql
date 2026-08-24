-- ================================================================
--  CAPELLA ENERGY — CRM : VUES RAPIDES PERSONNALISABLES
--  Migration 0005
-- ================================================================
--  Ajoute un drapeau « vue rapide » aux étapes de prospection.
--  L'admin coche les étapes qui apparaissent comme boutons de filtre
--  rapide en haut de la liste de prospection. Partagé pour toute l'équipe.
--
--  À exécuter après 0004. Rejouable sans risque.
-- ================================================================

alter table public.prospect_stages
  add column if not exists quick_filter boolean not null default false;

-- Valeurs de départ : on reprend les étapes « en travail » qui étaient déjà
-- les plus utiles au quotidien, pour ne pas partir d'une barre vide.
update public.prospect_stages
   set quick_filter = true
 where label in ('NRP', 'Rappels', 'RDV comparatif', 'RIB');
