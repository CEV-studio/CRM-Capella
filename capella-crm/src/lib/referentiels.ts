import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Source,
  Apporteur,
  Fournisseur,
  StageRow,
  ChampPersonnalise,
} from "@/lib/domain/database.types";

/**
 * Référentiels : petites tables qui ne changent presque jamais (sources,
 * apporteurs, fournisseurs, étapes des pipelines).
 *
 * Chaque chargeur est enveloppé dans `cache()` de React : au sein d'une même
 * requête, si plusieurs endroits demandent la même liste, la base n'est
 * interrogée qu'UNE fois. Combiné au fait que les pages lancent désormais ces
 * lectures EN PARALLÈLE de leur requête principale (et non plus après), les
 * référentiels n'ajoutent plus de temps d'attente perceptible.
 *
 * On les lit avec le client d'administration : ce sont des données non
 * sensibles, identiques pour tout le monde, sans lien avec la session — donc
 * pas de couplage aux cookies de l'utilisateur, et toujours à jour (pas de
 * cache inter-requêtes qui pourrait afficher une liste périmée après, par
 * exemple, la création d'une source).
 */

/** Toutes les sources, triées par nom (actives ET inactives). */
export const chargerSources = cache(async (): Promise<Source[]> => {
  const admin = createAdminClient();
  const { data } = await admin.from("sources").select("*").order("name");
  return (data ?? []) as Source[];
});

/** Tous les apporteurs, triés par nom (actifs ET inactifs). */
export const chargerApporteurs = cache(async (): Promise<Apporteur[]> => {
  const admin = createAdminClient();
  const { data } = await admin.from("apporteurs").select("*").order("name");
  return (data ?? []) as Apporteur[];
});

/** Tous les fournisseurs d'énergie mis en concurrence, ordre d'affichage. */
export const chargerFournisseurs = cache(async (): Promise<Fournisseur[]> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("fournisseurs")
    .select("*")
    .order("sort_order");
  return (data ?? []) as Fournisseur[];
});

/** Les étapes du pipeline prospection, dans l'ordre. */
export const chargerEtapesProspect = cache(async (): Promise<StageRow[]> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prospect_stages")
    .select("*")
    .order("sort_order");
  return (data ?? []) as StageRow[];
});

/** Les étapes du pipeline conversion (affaires), dans l'ordre. */
export const chargerEtapesAffaire = cache(async (): Promise<StageRow[]> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("affaire_stages")
    .select("*")
    .order("sort_order");
  return (data ?? []) as StageRow[];
});

/** Les définitions de champs personnalisés, triées par libellé. */
export const chargerChampsPersonnalises = cache(
  async (): Promise<ChampPersonnalise[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("champs_personnalises")
      .select("*")
      .order("libelle");
    return (data ?? []) as ChampPersonnalise[];
  },
);
