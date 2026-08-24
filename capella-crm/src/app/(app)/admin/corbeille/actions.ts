"use server";

import { revalidatePath } from "next/cache";
import { requireManage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_PIECES } from "@/lib/supabase/storage";
import type { ActionResult } from "@/lib/action-result";

/**
 * Corbeille — réservée à la gestion d'équipe (requireManage).
 * La suppression est « douce » : un prospect/affaire mis à la corbeille
 * disparaît des listes mais reste en base, récupérable, jusqu'à sa
 * suppression définitive.
 */

type Cible = "prospect" | "affaire";

function table(cible: string): "prospects" | "affaires" | null {
  if (cible === "prospect") return "prospects";
  if (cible === "affaire") return "affaires";
  return null;
}

function rafraichir() {
  revalidatePath("/admin/corbeille");
  revalidatePath("/prospection");
  revalidatePath("/conversion");
  revalidatePath("/");
}

/** Met un prospect ou une affaire à la corbeille. */
export async function mettreCorbeille(
  cible: Cible,
  id: string,
): Promise<ActionResult> {
  await requireManage();
  const t = table(cible);
  if (!t || !id) return { ok: false, message: "Élément introuvable." };

  const admin = createAdminClient();
  const { error } = await admin
    .from(t)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, message: `Échec : ${error.message}` };
  rafraichir();
  return { ok: true, message: "Déplacé dans la corbeille." };
}

/** Met plusieurs prospects/affaires à la corbeille en une fois. */
export async function mettreCorbeilleEnMasse(
  cible: Cible,
  ids: string[],
): Promise<ActionResult> {
  await requireManage();
  const t = table(cible);
  if (!t) return { ok: false, message: "Cible inconnue." };
  const propres = ids.filter(Boolean);
  if (propres.length === 0) return { ok: false, message: "Aucun élément sélectionné." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(t)
    .update({ deleted_at: new Date().toISOString() })
    .in("id", propres)
    .is("deleted_at", null)
    .select("id");

  if (error) return { ok: false, message: `Échec : ${error.message}` };
  rafraichir();
  return {
    ok: true,
    message: `${data.length} élément(s) déplacé(s) dans la corbeille.`,
  };
}

/** Restaure un élément de la corbeille. */
export async function restaurer(cible: Cible, id: string): Promise<ActionResult> {
  await requireManage();
  const t = table(cible);
  if (!t || !id) return { ok: false, message: "Élément introuvable." };

  const admin = createAdminClient();
  const { error } = await admin.from(t).update({ deleted_at: null }).eq("id", id);

  if (error) return { ok: false, message: `Échec : ${error.message}` };
  rafraichir();
  return { ok: true, message: "Restauré." };
}

/** Restaure plusieurs éléments de la corbeille en une fois. */
export async function restaurerEnMasse(
  cible: Cible,
  ids: string[],
): Promise<ActionResult> {
  await requireManage();
  const t = table(cible);
  if (!t) return { ok: false, message: "Cible inconnue." };
  const propres = ids.filter(Boolean);
  if (propres.length === 0) return { ok: false, message: "Aucun élément sélectionné." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(t)
    .update({ deleted_at: null })
    .in("id", propres)
    .not("deleted_at", "is", null)
    .select("id");

  if (error) return { ok: false, message: `Échec : ${error.message}` };
  rafraichir();
  return { ok: true, message: `${data.length} élément(s) restauré(s).` };
}

/**
 * Supprime définitivement : efface d'abord les fichiers du Storage, puis la
 * ligne (le lien vers les pièces jointes est effacé en cascade en base).
 */
export async function supprimerDefinitif(
  cible: Cible,
  id: string,
): Promise<ActionResult> {
  await requireManage();
  const t = table(cible);
  if (!t || !id) return { ok: false, message: "Élément introuvable." };

  const admin = createAdminClient();
  const colonne = cible === "prospect" ? "prospect_id" : "affaire_id";

  // 1) Retirer les fichiers du bucket (le Storage ne se vide pas tout seul).
  const { data: pieces } = await admin
    .from("pieces_jointes")
    .select("bucket_path")
    .eq(colonne, id);

  const chemins = (pieces ?? []).map((p) => p.bucket_path).filter(Boolean);
  if (chemins.length > 0) {
    await admin.storage.from(BUCKET_PIECES).remove(chemins);
  }

  // 2) Supprimer la ligne : les pieces_jointes liées partent en cascade.
  const { error } = await admin.from(t).delete().eq("id", id);
  if (error) return { ok: false, message: `Échec : ${error.message}` };

  rafraichir();
  return { ok: true, message: "Supprimé définitivement." };
}

/**
 * Supprime définitivement plusieurs éléments en une fois : d'abord tous les
 * fichiers du Storage liés, puis les lignes (pièces jointes en cascade).
 */
export async function supprimerDefinitifEnMasse(
  cible: Cible,
  ids: string[],
): Promise<ActionResult> {
  await requireManage();
  const t = table(cible);
  if (!t) return { ok: false, message: "Cible inconnue." };
  const propres = ids.filter(Boolean);
  if (propres.length === 0) return { ok: false, message: "Aucun élément sélectionné." };

  const admin = createAdminClient();
  const colonne = cible === "prospect" ? "prospect_id" : "affaire_id";

  // 1) Retirer du bucket tous les fichiers liés aux éléments sélectionnés.
  const { data: pieces } = await admin
    .from("pieces_jointes")
    .select("bucket_path")
    .in(colonne, propres);

  const chemins = (pieces ?? []).map((p) => p.bucket_path).filter(Boolean);
  if (chemins.length > 0) {
    await admin.storage.from(BUCKET_PIECES).remove(chemins);
  }

  // 2) Supprimer les lignes (uniquement celles déjà en corbeille, par sûreté).
  const { data, error } = await admin
    .from(t)
    .delete()
    .in("id", propres)
    .not("deleted_at", "is", null)
    .select("id");

  if (error) return { ok: false, message: `Échec : ${error.message}` };
  rafraichir();
  return {
    ok: true,
    message: `${data.length} élément(s) supprimé(s) définitivement.`,
  };
}
