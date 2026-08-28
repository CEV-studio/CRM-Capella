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
  const koReason = String(formData.get("ko_reason") ?? "").trim();
  if (!id || !stage) return { ok: false, message: "Affaire introuvable." };
  if (stage === "KO" && !koReason) return { ok: false, message: "Explique pourquoi le dossier est KO." };

  const supabase = await createClient();
  const { data: actuelle } = await supabase.from("affaires").select("stage").eq("id", id).maybeSingle();

  if (profil.role !== "admin") {
    if (stage === "Signé") return { ok: false, message: "La validation finale est réservée à l’ADV." };
    if (actuelle?.stage === "Signé") return { ok: false, message: "Ce dossier a déjà été validé par l’ADV." };
  }

  const patch: { stage: string; ko_reason?: string } = { stage };
  if (stage === "KO") patch.ko_reason = koReason;
  const { error } = await supabase.from("affaires").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/conversion");
  revalidatePath("/adv");
  return { ok: true, message: stage === "KO" ? "Dossier passé en KO avec motif." : `Étape : ${stage}` };
}

const CHAMPS_TEXTE = [
  "raison_sociale", "adresse_conso", "siren", "nom", "prenom", "mail",
  "telephone", "fournisseur", "contrat", "pdl_elec", "pce_gaz", "notes", "ko_reason",
] as const;
const CHAMPS_DATE = ["date_debut", "date_echeance", "date_entree", "date_signature", "date_relance"] as const;

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

  if (formData.has("commission")) {
    const commission = String(formData.get("commission") ?? "").replace(",", ".").trim();
    patch.commission = commission ? Number(commission) : 0;
  }
  return patch;
}

function verifierMontants(patch: Record<string, unknown>): string | null {
  if (patch.car_mwh != null && !Number.isFinite(patch.car_mwh as number)) return "La CAR doit être un nombre (en MWh).";
  if (patch.commission != null && !Number.isFinite(patch.commission as number)) return "La commission doit être un montant en euros.";
  return null;
}

export async function enregistrerAffaire(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const profil = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Affaire introuvable." };

  const patch = lireFormulaire(formData);
  if (profil.role !== "admin") {
    delete patch.commission;
    delete patch.date_signature;
    if (patch.stage === "Signé") delete patch.stage;
  }

  const souci = verifierMontants(patch);
  if (souci) return { ok: false, message: souci };
  if (!patch.raison_sociale) return { ok: false, message: "La raison sociale est obligatoire." };
  if (patch.stage === "KO" && !String(patch.ko_reason ?? "").trim()) return { ok: false, message: "Le motif du KO est obligatoire." };

  const supabase = await createClient();
  if (profil.role !== "admin") {
    const { data: actuelle } = await supabase.from("affaires").select("stage").eq("id", id).maybeSingle();
    if (actuelle?.stage === "Signé") delete patch.stage;
  }

  const { error } = await supabase.from("affaires").update(patch as AffaireInsert).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/conversion");
  revalidatePath(`/conversion/${id}`);
  revalidatePath("/adv");
  return { ok: true, message: "Affaire enregistrée." };
}

export async function creerAffaire(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const profil = await requireProfile();
  const patch = lireFormulaire(formData);
  if (profil.role !== "admin") {
    delete patch.commission;
    delete patch.date_signature;
    if (patch.stage === "Signé") patch.stage = "Demande de cotation";
  }
  const souci = verifierMontants(patch);
  if (souci) return { ok: false, message: souci };
  if (!patch.raison_sociale) return { ok: false, message: "La raison sociale est obligatoire." };
  if (patch.stage === "KO" && !String(patch.ko_reason ?? "").trim()) return { ok: false, message: "Le motif du KO est obligatoire." };

  const commercial = profil.role === "admin" ? String(formData.get("commercial_id") ?? "").trim() || profil.id : profil.id;
  const prospectId = String(formData.get("prospect_id") ?? "").trim() || null;
  const sourceId = String(formData.get("source_id") ?? "").trim() || null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("affaires").insert({
    ...(patch as AffaireInsert), commercial_id: commercial, prospect_id: prospectId, source_id: sourceId, created_by: profil.id,
  }).select("id").single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/conversion");
  revalidatePath("/prospection");
  redirect(`/conversion/${data.id}`);
}

export async function convertirProspect(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const profil = await requireProfile();
  const prospectId = String(formData.get("prospect_id") ?? "").trim();
  if (!prospectId) return { ok: false, message: "Prospect introuvable." };
  const supabase = await createClient();
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospectId).maybeSingle();
  if (!prospect) return { ok: false, message: "Prospect introuvable." };
  const p = prospect as Prospect;
  const { data: dejaLa } = await supabase.from("affaires").select("id").eq("prospect_id", prospectId).maybeSingle();
  if (dejaLa) redirect(`/conversion/${dejaLa.id}`);

  const raison = p.raison_sociale ?? ([p.prenom, p.nom].filter(Boolean).join(" ") || "(sans nom)");
  const { data, error } = await supabase.from("affaires").insert({
    commercial_id: p.assigned_to ?? profil.id, prospect_id: p.id, source_id: p.source_id,
    raison_sociale: raison, siren: p.siren, nom: p.nom, prenom: p.prenom, mail: p.mail,
    telephone: p.tel_mobile ?? p.tel_fixe, pdl_elec: p.pdl, pce_gaz: p.pce,
    fournisseur: p.fournisseur_electricite, date_echeance: p.date_fin_contrat,
    notes: p.notes, stage: "Demande de cotation", created_by: profil.id,
  }).select("id").single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/conversion");
  revalidatePath("/prospection");
  redirect(`/conversion/${data.id}`);
}
