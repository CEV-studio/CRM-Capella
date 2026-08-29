"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  BUCKET_PIECES,
  cheminPiece,
  TAILLE_MAX,
} from "@/lib/supabase/storage";
import type { ActionResult } from "@/lib/action-result";

export async function ajouterPiece(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const scope = String(formData.get("scope") ?? "") as "prospect" | "affaire";
  const parentId = String(formData.get("parent_id") ?? "").trim();
  const type = String(formData.get("type") ?? "") as "ACD" | "Facture";
  const fichiers = formData
    .getAll("fichiers")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (scope !== "prospect" && scope !== "affaire") return { ok: false, message: "Cible inconnue." };
  if (!parentId) return { ok: false, message: "Élément introuvable." };
  if (type !== "ACD" && type !== "Facture") return { ok: false, message: "Type de document inconnu." };
  if (fichiers.length === 0) return { ok: false, message: "Choisis au moins un fichier PDF." };

  const tropLourds = fichiers.filter((f) => f.size > TAILLE_MAX);
  if (tropLourds.length) {
    return { ok: false, message: `Fichier(s) trop lourd(s) : ${tropLourds.map((f) => f.name).join(", ")} (10 Mo maximum par fichier).` };
  }

  const mauvaisFormats = fichiers.filter((f) => f.type !== "application/pdf" || !f.name.toLowerCase().endsWith(".pdf"));
  if (mauvaisFormats.length) {
    return { ok: false, message: `Format non accepté : ${mauvaisFormats.map((f) => f.name).join(", ")} (PDF uniquement).` };
  }

  const supabase = await createClient();
  const ajoutes: string[] = [];
  const erreurs: string[] = [];

  for (const fichier of fichiers) {
    const chemin = cheminPiece(scope, parentId, fichier.name);
    const { error: errUpload } = await supabase.storage.from(BUCKET_PIECES).upload(chemin, fichier, { contentType: "application/pdf", upsert: false });
    if (errUpload) { erreurs.push(`${fichier.name} : ${errUpload.message}`); continue; }

    const { error: errLigne } = await supabase.from("pieces_jointes").insert({
      type,
      prospect_id: scope === "prospect" ? parentId : null,
      affaire_id: scope === "affaire" ? parentId : null,
      bucket_path: chemin,
      file_name: fichier.name,
      mime: "application/pdf",
      taille: fichier.size,
    });

    if (errLigne) {
      await supabase.storage.from(BUCKET_PIECES).remove([chemin]);
      erreurs.push(`${fichier.name} : ${errLigne.message}`);
      continue;
    }
    ajoutes.push(fichier.name);
  }

  const base = scope === "prospect" ? "/prospection" : "/conversion";
  revalidatePath(`${base}/${parentId}`);

  if (erreurs.length && ajoutes.length === 0) return { ok: false, message: `Aucun fichier ajouté. ${erreurs.join(" · ")}` };
  if (erreurs.length) return { ok: false, message: `${ajoutes.length} fichier(s) ajouté(s), ${erreurs.length} échec(s) : ${erreurs.join(" · ")}` };
  return { ok: true, message: ajoutes.length === 1 ? `${type} ajouté.` : `${ajoutes.length} fichiers ${type.toLowerCase()} ajoutés.` };
}

export async function supprimerPiece(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Pièce introuvable." };

  const supabase = await createClient();
  const { data: piece } = await supabase.from("pieces_jointes").select("bucket_path, prospect_id, affaire_id").eq("id", id).maybeSingle();
  if (!piece) return { ok: false, message: "Pièce introuvable." };

  await supabase.storage.from(BUCKET_PIECES).remove([piece.bucket_path]);
  const { error } = await supabase.from("pieces_jointes").delete().eq("id", id);
  if (error) return { ok: false, message: `Échec : ${error.message}` };

  if (piece.prospect_id) revalidatePath(`/prospection/${piece.prospect_id}`);
  if (piece.affaire_id) revalidatePath(`/conversion/${piece.affaire_id}`);
  return { ok: true, message: "Pièce supprimée." };
}
