"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import type { AffaireInsert, Prospect } from "@/lib/domain/database.types";

/**
 * Comme en prospection : on écrit avec la session de l'utilisateur.
 * RLS interdit à un commercial de toucher l'affaire d'un autre, et le
 * WITH CHECK l'empêche de se l'attribuer ou de la céder.
 */

export async function changerEtapeAffaire(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!id || !stage) return { ok: false, message: "Affaire introuvable." };

  const supabase = await createClient();
  const { error } = await supabase.from("affaires").update({ stage }).eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/conversion");
  return { ok: true, message: `Étape : ${stage}` };
}

const CHAMPS_TEXTE = [
  "raison_sociale", "adresse_conso", "siren", "nom", "prenom", "mail",
  "telephone", "fournisseur", "contrat", "pdl_elec", "pce_gaz",
  "notes",
] as const;

const CHAMPS_DATE = [
  "date_debut", "date_echeance", "date_entree", "date_signature", "date_relance",
] as const;

function lireFormulaire(formData: FormData) {
  const patch: Record<string, unknown> = {};

  for (const champ of CHAMPS_TEXTE) {
    const v = String(formData.get(champ) ?? "").trim();
    patch[champ] = v || null;
  }
  for (const champ of CHAMPS_DATE) {
    const v = String(formData.get(champ) ?? "").trim();
    patch[champ] = v || null;
  }

  const typeEnergie = String(formData.get("type_energie") ?? "").trim();
  patch.type_energie = typeEnergie || null;

  const stage = String(formData.get("stage") ?? "").trim();
  if (stage) patch.stage = stage;

  const apporteur = String(formData.get("apporteur_id") ?? "").trim();
  patch.apporteur_id = apporteur || null;

  const car = String(formData.get("car_mwh") ?? "").replace(",", ".").trim();
  patch.car_mwh = car ? Number(car) : null;

  const commission = String(formData.get("commission") ?? "").replace(",", ".").trim();
  patch.commission = commission ? Number(commission) : 0;

  return patch;
}

function verifierMontants(patch: Record<string, unknown>): string | null {
  if (patch.car_mwh != null && !Number.isFinite(patch.car_mwh as number)) {
    return "La CAR doit être un nombre (en MWh).";
  }
  if (!Number.isFinite(patch.commission as number)) {
    return "La commission doit être un montant en euros.";
  }
  return null;
}

export async function enregistrerAffaire(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Affaire introuvable." };

  const patch = lireFormulaire(formData);
  const souci = verifierMontants(patch);
  if (souci) return { ok: false, message: souci };

  if (!patch.raison_sociale) {
    return { ok: false, message: "La raison sociale est obligatoire." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("affaires")
    .update(patch as AffaireInsert)
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/conversion");
  revalidatePath(`/conversion/${id}`);
  return { ok: true, message: "Affaire enregistrée." };
}

export async function creerAffaire(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profil = await requireProfile();

  const patch = lireFormulaire(formData);
  const souci = verifierMontants(patch);
  if (souci) return { ok: false, message: souci };

  if (!patch.raison_sociale) {
    return { ok: false, message: "La raison sociale est obligatoire." };
  }

  // Un commercial crée forcément pour lui-même ; l'admin peut désigner.
  const commercial =
    profil.role === "admin"
      ? String(formData.get("commercial_id") ?? "").trim() || profil.id
      : profil.id;

  const prospectId = String(formData.get("prospect_id") ?? "").trim() || null;
  const sourceId = String(formData.get("source_id") ?? "").trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("affaires")
    .insert({
      ...(patch as AffaireInsert),
      commercial_id: commercial,
      prospect_id: prospectId,
      source_id: sourceId,
      created_by: profil.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath("/conversion");
  revalidatePath("/prospection");
  redirect(`/conversion/${data.id}`);
}

/**
 * Bascule d'un prospect vers une affaire.
 * On ne supprime rien : le prospect reste, marqué comme converti, et
 * l'affaire garde le lien vers lui — c'est ce qui permet de répondre plus
 * tard à « d'où vient cette affaire ».
 */
export async function convertirProspect(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profil = await requireProfile();

  const prospectId = String(formData.get("prospect_id") ?? "").trim();
  if (!prospectId) return { ok: false, message: "Prospect introuvable." };

  const supabase = await createClient();
  const { data: prospect } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", prospectId)
    .maybeSingle();

  if (!prospect) return { ok: false, message: "Prospect introuvable." };

  const p = prospect as Prospect;

  const { data: dejaLa } = await supabase
    .from("affaires")
    .select("id")
    .eq("prospect_id", prospectId)
    .maybeSingle();

  if (dejaLa) {
    redirect(`/conversion/${dejaLa.id}`);
  }

  const { data, error } = await supabase
    .from("affaires")
    .insert({
      commercial_id: p.assigned_to ?? profil.id,
      prospect_id: p.id,
      source_id: p.source_id,
      raison_sociale:
        p.raison_sociale ??
        [p.prenom, p.nom].filter(Boolean).join(" ") ??
        "(sans nom)",
      siren: p.siren,
      nom: p.nom,
      prenom: p.prenom,
      mail: p.mail,
      telephone: p.tel_mobile ?? p.tel_fixe,
      pdl_elec: p.pdl,
      pce_gaz: p.pce,
      fournisseur: p.fournisseur_electricite,
      date_echeance: p.date_fin_contrat,
      notes: p.notes,
      stage: "Demande de cotation",
      created_by: profil.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath("/conversion");
  revalidatePath("/prospection");
  redirect(`/conversion/${data.id}`);
}
