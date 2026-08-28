"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManage, requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import type { Prospect, ProspectInsert } from "@/lib/domain/database.types";
import { PROSPECT_STAGES } from "@/lib/domain/stages";

function messageLisible(brut: string): string {
  if (brut.includes("DFF trop éloigné")) {
    return "Renseigne d'abord la « Date fin contrat » sur la fiche avant de passer en « DFF trop éloigné ».";
  }
  return brut;
}

export async function modifierVuesRapides(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireManage();
  const choisies = new Set(formData.getAll("etapes").map(String));
  const admin = createAdminClient();
  for (const s of PROSPECT_STAGES) {
    const { error } = await admin.from("prospect_stages").update({ quick_filter: choisies.has(s.label) }).eq("label", s.label);
    if (error) return { ok: false, message: `Échec : ${error.message}` };
  }
  revalidatePath("/prospection");
  revalidatePath("/clients");
  return { ok: true, message: "Vues rapides mises à jour." };
}

async function creerCotationDepuisProspect(id: string, profilId: string) {
  const supabase = await createClient();
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!prospect) throw new Error("Client introuvable.");
  const p = prospect as Prospect;

  const { data: existante } = await supabase.from("affaires").select("id").eq("prospect_id", id).is("deleted_at", null).maybeSingle();
  if (existante) return existante.id;

  const raisonSociale = p.raison_sociale ?? ([p.prenom, p.nom].filter(Boolean).join(" ") || "(sans nom)");
  const { data, error } = await supabase.from("affaires").insert({
    commercial_id: p.assigned_to ?? profilId,
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
    created_by: profilId,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function changerEtape(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const profil = await requireProfile();
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  const koReason = String(formData.get("ko_reason") ?? "").trim();
  if (!id || !stage) return { ok: false, message: "Prospect introuvable." };
  if (stage === "KO" && !koReason) return { ok: false, message: "Explique pourquoi ce dossier est KO." };

  const supabase = await createClient();
  const patch: { stage: string; ko_reason?: string } = { stage };
  if (stage === "KO") patch.ko_reason = koReason;
  const { error } = await supabase.from("prospects").update(patch).eq("id", id);
  if (error) return { ok: false, message: messageLisible(error.message) };

  if (stage === "Demande de cotation") {
    try {
      await creerCotationDepuisProspect(id, profil.id);
      await (supabase as any).from("prospects").update({ entered_conversion_at: new Date().toISOString() }).eq("id", id);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Création de la cotation impossible." };
    }
  }

  revalidatePath("/prospection");
  revalidatePath("/clients");
  revalidatePath("/conversion");
  revalidatePath("/adv");
  revalidatePath(`/prospection/${id}`);
  return { ok: true, message: stage === "Demande de cotation" ? "Client basculé dans Cotations." : stage === "KO" ? "Dossier passé en KO avec motif." : `Étape : ${stage}` };
}

export async function enregistrerProchaineAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  const texte = String(formData.get("next_action") ?? "").trim();
  const date = String(formData.get("next_action_date") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ next_action: texte || null, next_action_date: date || null }).eq("id", id);
  if (error) return { ok: false, message: messageLisible(error.message) };
  revalidatePath("/prospection");
  revalidatePath("/clients");
  return { ok: true, message: "Enregistré." };
}

export async function enregistrerNotes(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireProfile();
  const id = String(formData.get("id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) return { ok: false, message: "Prospect introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update({ notes: notes || null }).eq("id", id);
  if (error) return { ok: false, message: messageLisible(error.message) };
  revalidatePath("/prospection");
  revalidatePath("/clients");
  revalidatePath(`/prospection/${id}`);
  return { ok: true, message: "Note enregistrée." };
}

const CHAMPS_FICHE = [
  "nom", "prenom", "mail", "tel_mobile", "tel_fixe",
  "raison_sociale", "siren", "naf", "code_postal", "segment",
  "pdl", "pce", "option_tarifaire",
  "fournisseur_electricite", "fournisseur_gaz", "notes", "next_action", "ko_reason",
] as const;
const CHAMPS_DATE = ["date_fin_contrat", "next_action_date"] as const;
const CHAMPS_NOMBRE = ["nb_sites", "score"] as const;
const CHAMPS_DECIMAL = ["car_electricite", "car_gaz"] as const;

function lireFormulaire(formData: FormData): ProspectInsert {
  const patch: Record<string, unknown> = {};
  for (const champ of CHAMPS_FICHE) {
    const v = String(formData.get(champ) ?? "").trim();
    patch[champ] = v || null;
  }
  for (const champ of CHAMPS_DATE) {
    const v = String(formData.get(champ) ?? "").trim();
    patch[champ] = v || null;
  }
  for (const champ of CHAMPS_NOMBRE) {
    const v = String(formData.get(champ) ?? "").trim();
    patch[champ] = v ? Number(v) : null;
  }
  for (const champ of CHAMPS_DECIMAL) {
    const v = String(formData.get(champ) ?? "").replace(",", ".").trim();
    patch[champ] = v ? Number(v) : null;
  }
  const stage = String(formData.get("stage") ?? "").trim();
  if (stage) patch.stage = stage;
  const source = String(formData.get("source_id") ?? "").trim();
  patch.source_id = source || null;
  const champsPerso: Record<string, string> = {};
  for (const [nom, valeur] of formData.entries()) {
    if (!nom.startsWith("perso_")) continue;
    const v = String(valeur).trim();
    if (v) champsPerso[nom.slice("perso_".length)] = v;
  }
  patch.champs_perso = champsPerso;
  return patch as ProspectInsert;
}

export async function enregistrerFiche(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const profil = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Prospect introuvable." };
  const patch = lireFormulaire(formData);
  if (patch.stage === "KO" && !String(patch.ko_reason ?? "").trim()) return { ok: false, message: "Le motif du KO est obligatoire." };
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").update(patch).eq("id", id);
  if (error) return { ok: false, message: messageLisible(error.message) };

  if (patch.stage === "Demande de cotation") {
    try {
      await creerCotationDepuisProspect(id, profil.id);
      await (supabase as any).from("prospects").update({ entered_conversion_at: new Date().toISOString() }).eq("id", id);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Création de la cotation impossible." };
    }
  }

  revalidatePath("/prospection");
  revalidatePath("/clients");
  revalidatePath("/conversion");
  revalidatePath("/adv");
  revalidatePath(`/prospection/${id}`);
  return { ok: true, message: "Fiche enregistrée." };
}

export async function creerProspect(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const profil = await requireProfile();
  const patch = lireFormulaire(formData);
  if (!patch.raison_sociale && !patch.nom && !patch.prenom) return { ok: false, message: "Renseigne au moins une raison sociale ou un nom." };
  if (patch.stage === "KO" && !String(patch.ko_reason ?? "").trim()) return { ok: false, message: "Le motif du KO est obligatoire." };
  const supabase = await createClient();
  const proprietaire = profil.role === "admin" ? String(formData.get("assigned_to") ?? "").trim() || null : profil.id;
  const { data, error } = await supabase.from("prospects").insert({ ...patch, assigned_to: proprietaire, created_by: profil.id }).select("id").single();
  if (error) return { ok: false, message: messageLisible(error.message) };
  revalidatePath("/prospection");
  revalidatePath("/clients");
  redirect(`/prospection/${data.id}`);
}
