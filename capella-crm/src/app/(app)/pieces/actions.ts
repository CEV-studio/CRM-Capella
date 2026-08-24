"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  BUCKET_PIECES,
  cheminPiece,
  mimeAutorise,
  TAILLE_MAX,
} from "@/lib/supabase/storage";
import type { ActionResult } from "@/lib/action-result";

/**
 * Pièces jointes ACD / Facture.
 * On écrit avec la session de l'utilisateur : les règles du bucket et de la
 * table `pieces_jointes` (RLS) garantissent qu'on ne peut déposer/lire un
 * fichier que sur un prospect/affaire qui nous appartient.
 */

export async function ajouterPiece(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const scope = String(formData.get("scope") ?? "") as "prospect" | "affaire";
  const parentId = String(formData.get("parent_id") ?? "").trim();
  const type = String(formData.get("type") ?? "") as "ACD" | "Facture";
  const fichier = formData.get("fichier");

  if (scope !== "prospect" && scope !== "affaire") {
    return { ok: false, message: "Cible inconnue." };
  }
  if (!parentId) return { ok: false, message: "Élément introuvable." };
  if (type !== "ACD" && type !== "Facture") {
    return { ok: false, message: "Type de document inconnu." };
  }
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Choisis un fichier." };
  }
  if (fichier.size > TAILLE_MAX) {
    return { ok: false, message: "Fichier trop lourd (10 Mo maximum)." };
  }
  if (!mimeAutorise(fichier.type)) {
    return { ok: false, message: "Format non accepté (PDF, JPG ou PNG uniquement)." };
  }

  const supabase = await createClient();
  const chemin = cheminPiece(scope, parentId, fichier.name);

  const { error: errUpload } = await supabase.storage
    .from(BUCKET_PIECES)
    .upload(chemin, fichier, { contentType: fichier.type, upsert: false });

  if (errUpload) {
    return { ok: false, message: `Envoi impossible : ${errUpload.message}` };
  }

  const { error: errLigne } = await supabase.from("pieces_jointes").insert({
    type,
    prospect_id: scope === "prospect" ? parentId : null,
    affaire_id: scope === "affaire" ? parentId : null,
    bucket_path: chemin,
    file_name: fichier.name,
    mime: fichier.type,
    taille: fichier.size,
  });

  if (errLigne) {
    // On retire le fichier orphelin si la ligne n'a pas pu s'écrire.
    await supabase.storage.from(BUCKET_PIECES).remove([chemin]);
    return { ok: false, message: `Enregistrement impossible : ${errLigne.message}` };
  }

  const base = scope === "prospect" ? "/prospection" : "/conversion";
  revalidatePath(`${base}/${parentId}`);
  return { ok: true, message: `${type} ajouté.` };
}

export async function supprimerPiece(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Pièce introuvable." };

  const supabase = await createClient();

  // RLS : ne remonte la pièce que si l'utilisateur a le droit de la voir.
  const { data: piece } = await supabase
    .from("pieces_jointes")
    .select("bucket_path, prospect_id, affaire_id")
    .eq("id", id)
    .maybeSingle();

  if (!piece) return { ok: false, message: "Pièce introuvable." };

  await supabase.storage.from(BUCKET_PIECES).remove([piece.bucket_path]);
  const { error } = await supabase.from("pieces_jointes").delete().eq("id", id);
  if (error) return { ok: false, message: `Échec : ${error.message}` };

  if (piece.prospect_id) revalidatePath(`/prospection/${piece.prospect_id}`);
  if (piece.affaire_id) revalidatePath(`/conversion/${piece.affaire_id}`);
  return { ok: true, message: "Pièce supprimée." };
}
