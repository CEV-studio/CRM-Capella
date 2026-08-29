import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
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
const sourcesCache = unstable_cache(async (): Promise<Source[]> => {
  const admin = createAdminClient();
  const { data } = await admin.from("sources").select("*").order("name");
  return (data ?? []) as Source[];
}, ["referentiels-sources"], { revalidate: 60 });
export const chargerSources = cache(sourcesCache);

/** Tous les apporteurs, triés par nom (actifs ET inactifs). */
const apporteursCache = unstable_cache(async (): Promise<Apporteur[]> => {
  const admin = createAdminClient();
  const { data } = await admin.from("apporteurs").select("*").order("name");
  return (data ?? []) as Apporteur[];
}, ["referentiels-apporteurs"], { revalidate: 60 });
export const chargerApporteurs = cache(apporteursCache);

/** Tous les fournisseurs d'énergie mis en concurrence, ordre d'affichage. */
const fournisseursCache = unstable_cache(async (): Promise<Fournisseur[]> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("fournisseurs")
    .select("*")
    .order("sort_order");
  return (data ?? []) as Fournisseur[];
}, ["referentiels-fournisseurs"], { revalidate: 60 });
export const chargerFournisseurs = cache(fournisseursCache);

/** Les étapes du pipeline prospection, dans l'ordre. */
const etapesProspectCache = unstable_cache(async (): Promise<StageRow[]> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prospect_stages")
    .select("*")
    .order("sort_order");
  return (data ?? []) as StageRow[];
}, ["referentiels-etapes-prospect"], { revalidate: 60 });
export const chargerEtapesProspect = cache(etapesProspectCache);

/** Les étapes du pipeline conversion (affaires), dans l'ordre. */
const etapesAffaireCache = unstable_cache(async (): Promise<StageRow[]> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("affaire_stages")
    .select("*")
    .order("sort_order");
  return (data ?? []) as StageRow[];
}, ["referentiels-etapes-affaire"], { revalidate: 60 });
export const chargerEtapesAffaire = cache(etapesAffaireCache);

/** Les définitions de champs personnalisés, triées par libellé. */
const champsPersonnalisesCache = unstable_cache(
  async (): Promise<ChampPersonnalise[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("champs_personnalises")
      .select("*")
      .order("libelle");
    return (data ?? []) as ChampPersonnalise[];
  }, ["referentiels-champs-personnalises"], { revalidate: 60 },
);
export const chargerChampsPersonnalises = cache(champsPersonnalisesCache);
