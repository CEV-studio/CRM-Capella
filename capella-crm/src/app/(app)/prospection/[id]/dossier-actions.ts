"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PIECES, cheminPiece } from "@/lib/supabase/storage";

const txt = (v: FormDataEntryValue | null) => String(v || "").trim();

async function ctx(form: FormData) {
  const profile = await requireProfile();
  const prospectId = txt(form.get("prospect_id"));
  if (!prospectId) throw new Error("Prospect manquant.");
  const supabase = await createClient();
  const { data: prospect } = await supabase.from("prospects").select("id").eq("id", prospectId).is("deleted_at", null).maybeSingle();
  if (!prospect) throw new Error("Prospect inaccessible.");
  return { profile, prospectId, supabase };
}

export async function enregistrerEntreprise(form: FormData) {
  const { prospectId, supabase } = await ctx(form);
  const siren = txt(form.get("siren")).replace(/\D/g, "");
  if (siren && siren.length !== 9) throw new Error("Le SIREN doit contenir 9 chiffres.");
  const patch = {
    raison_sociale: txt(form.get("raison_sociale")) || null,
    siren: siren || null,
    adresse_entreprise: txt(form.get("adresse_entreprise")) || null,
    code_postal: txt(form.get("code_postal")) || null,
    ville: txt(form.get("ville")) || null,
  } as never;
  const { error } = await supabase.from("prospects").update(patch).eq("id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/prospection/${prospectId}`);
}

export async function ajouterContact(form: FormData) {
  const { prospectId, supabase } = await ctx(form);
  const nom = txt(form.get("nom"));
  const prenom = txt(form.get("prenom"));
  if (!nom || !prenom) throw new Error("Nom et prénom sont obligatoires.");
  const isPrimary = form.get("is_primary") === "on";
  const db = supabase as any;
  if (isPrimary) await db.from("prospect_contacts").update({ is_primary: false }).eq("prospect_id", prospectId);
  const { error } = await db.from("prospect_contacts").insert({
    prospect_id: prospectId, nom, prenom,
    telephone: txt(form.get("telephone")) || null,
    email: txt(form.get("email")) || null,
    fonction: txt(form.get("fonction")) || null,
    is_primary: isPrimary,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/prospection/${prospectId}`);
}

export async function supprimerContact(form: FormData) {
  const { prospectId, supabase } = await ctx(form);
  const id = txt(form.get("id"));
  const { error } = await (supabase as any).from("prospect_contacts").delete().eq("id", id).eq("prospect_id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/prospection/${prospectId}`);
}

export async function ajouterCompteur(form: FormData) {
  const { prospectId, supabase } = await ctx(form);
  const type = txt(form.get("type_energie"));
  const numero = txt(form.get("numero"));
  if (!numero || !["electricite", "gaz"].includes(type)) throw new Error("Compteur invalide.");
  const segment = type === "electricite" ? txt(form.get("segment")) : "";
  const { error } = await (supabase as any).from("prospect_compteurs").insert({
    prospect_id: prospectId,
    type_energie: type,
    numero,
    siret: txt(form.get("siret")) || null,
    adresse: txt(form.get("adresse")) || null,
    code_postal: txt(form.get("code_postal")) || null,
    ville: txt(form.get("ville")) || null,
    segment: segment || null,
    date_echeance: txt(form.get("date_echeance")) || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/prospection/${prospectId}`);
}

export async function supprimerCompteur(form: FormData) {
  const { prospectId, supabase } = await ctx(form);
  const id = txt(form.get("id"));
  const { error } = await (supabase as any).from("prospect_compteurs").delete().eq("id", id).eq("prospect_id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/prospection/${prospectId}`);
}

export async function ajouterFactureCompteur(form: FormData) {
  const { profile, prospectId, supabase } = await ctx(form);
  const compteurId = txt(form.get("compteur_id"));
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Facture manquante.");
  if (file.type !== "application/pdf") throw new Error("La facture doit être au format PDF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("10 Mo maximum par facture.");
  const { data: compteur } = await (supabase as any).from("prospect_compteurs").select("id").eq("id", compteurId).eq("prospect_id", prospectId).maybeSingle();
  if (!compteur) throw new Error("Compteur inaccessible.");
  const path = cheminPiece("prospect", prospectId, file.name);
  const { error: uploadError } = await supabase.storage.from(BUCKET_PIECES).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await (supabase as any).from("pieces_jointes").insert({
    type: "Facture", prospect_id: prospectId, affaire_id: null, compteur_id: compteurId,
    bucket_path: path, file_name: file.name, mime: file.type, taille: file.size, uploaded_by: profile.id,
  });
  if (error) {
    await supabase.storage.from(BUCKET_PIECES).remove([path]);
    throw new Error(error.message);
  }
  revalidatePath(`/prospection/${prospectId}`);
}
