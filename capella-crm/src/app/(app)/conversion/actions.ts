"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import type { AffaireInsert, Prospect } from "@/lib/domain/database.types";

export async function changerEtapeAffaire(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profil = await requireProfile();
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!id || !stage) return { ok: false, message: "Cotation introuvable." };

  if (stage === "Signé" && profil.role !== "admin") {
    return { ok: false, message: "Le passage en Signé est validé par l’ADV." };
  }

  const supabase = await createClient();
  const patch: Record<string, unknown> = { stage };
  if (stage === "Signé") patch.date_signature = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("affaires").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/conversion");
  revalidatePath("/adv");
  revalidatePath(`/conversion/${id}`);
  return { ok: true, message: `Étape : ${stage}` };
}

const CHAMPS_TEXTE = [
  "raison_sociale", "adresse_conso", "siren", "nom", "prenom", "mail",
  "telephone", "fournisseur", "contrat", "pdl_elec", "pce_gaz", "notes",
] as const;

const CHAMPS_DATE = [
  "date_debut", "date_echeance", "date_entree", "date_signature", "date_relance",
] as const;

function lireFormulaire(formData: FormData): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const champ of CHAMPS_TEXTE) {
    const valeur = String(formData.get(champ) ?? "").trim();
    patch[champ] = valeur || null;
  }
  for (const champ of CHAMPS_DATE) {
    const valeur = String(formData.get(champ) ?? "").trim();
    patch[champ] = valeur || null;
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
  if (commission !== "") patch.commission = Number(commission);

  return patch;
}

function verifierMontants(patch: Record<string, unknown>): string | null {
  if (patch.car_mwh != null && !Number.isFinite(patch.car_mwh as number)) {
    return "La CAR doit être un nombre (en MWh).";
  }
  if (patch.commission != null && !Number.isFinite(patch.commission as number)) {
    return "La commission doit être un montant en euros.";
  }
  return null;
}

export async function enregistrerAffaire(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profil = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Cotation introuvable." };

  const patch = lireFormulaire(formData);
  if (profil.role !== "admin") {
    delete patch.commission;
    delete patch.date_signature;
    if (patch.stage === "Signé") {
      return { ok: false, message: "Le passage en Signé est validé par l’ADV." };
    }
  }

  const souci = verifierMontants(patch);
  if (souci) return { ok: false, message: souci };
  if (!patch.raison_sociale) return { ok: false, message: "La raison sociale est obligatoire." };

  const supabase = await createClient();
  const { error } = await supabase.from("affaires").update(patch as AffaireInsert).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/conversion");
  revalidatePath("/adv");
  revalidatePath(`/conversion/${id}`);
  return { ok: true, message: "Cotation enregistrée." };
}

export async function creerAffaire(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profil = await requireProfile();
  const patch = lireFormulaire(formData);
  if (profil.role !== "admin") delete patch.commission;

  const souci = verifierMontants(patch);
  if (souci) return { ok: false, message: souci };
  if (!patch.raison_sociale) return { ok: false, message: "La raison sociale est obligatoire." };

  const commercial = profil.role === "admin"
    ? String(formData.get("commercial_id") ?? "").trim() || profil.id
    : profil.id;
  const prospectId = String(formData.get("prospect_id") ?? "").trim() || null;
  const sourceId = String(formData.get("source_id") ?? "").trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("affaires").insert({
    ...(patch as AffaireInsert),
    commercial_id: commercial,
    prospect_id: prospectId,
    source_id: sourceId,
    created_by: profil.id,
  }).select("id").single();

  if (error) return { ok: false, message: error.message };
  if (prospectId) {
    await (supabase as any).from("prospects").update({
      stage: "Demande de cotation",
      entered_conversion_at: new Date().toISOString(),
    }).eq("id", prospectId);
  }

  revalidatePath("/conversion");
  revalidatePath("/clients");
  revalidatePath("/adv");
  redirect(`/conversion/${data.id}`);
}

export async function convertirProspect(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profil = await requireProfile();
  const prospectId = String(formData.get("prospect_id") ?? "").trim();
  if (!prospectId) return { ok: false, message: "Client introuvable." };

  const supabase = await createClient();
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospectId).maybeSingle();
  if (!prospect) return { ok: false, message: "Client introuvable." };
  const p = prospect as Prospect;

  const { data: deja } = await supabase.from("affaires").select("id").eq("prospect_id", prospectId).maybeSingle();
  if (deja) redirect(`/conversion/${deja.id}`);

  const raisonSociale = p.raison_sociale ?? ([p.prenom, p.nom].filter(Boolean).join(" ") || "(sans nom)");
  const { data, error } = await supabase.from("affaires").insert({
    commercial_id: p.assigned_to ?? profil.id,
    prospect_id: p.id,
    source_id: p.source_id,
    raison_sociale: raisonSociale,
    siren: p.siren,
    nom: p.nom,
    prenom: p.prenom,
    mail: p.mail,
    telephone: p.tel_mobile ?? p.tel_fixe,
    pdl_elec: p.pdl,
    pce_gaz: p.pce,
    fournisseur: p.fournisseur_electricite ?? p.fournisseur_gaz,
    date_echeance: p.date_fin_contrat,
    notes: p.notes,
    stage: "Demande de cotation",
    created_by: profil.id,
  }).select("id").single();

  if (error) return { ok: false, message: error.message };

  await (supabase as any).from("prospects").update({
    stage: "Demande de cotation",
    entered_conversion_at: new Date().toISOString(),
  }).eq("id", prospectId);

  revalidatePath("/conversion");
  revalidatePath("/clients");
  revalidatePath("/adv");
  redirect(`/conversion/${data.id}`);
}
