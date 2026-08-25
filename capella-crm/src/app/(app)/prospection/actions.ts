"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManage, requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import type { ProspectInsert } from "@/lib/domain/database.types";
import { PROSPECT_STAGES } from "@/lib/domain/stages";

/**
 * Ces actions écrivent avec la session de l'utilisateur, jamais avec la clé
 * de service : c'est Postgres qui refuse une ligne qui n'appartient pas à
 * l'appelant. L'application n'a aucun filtrage de sécurité à faire elle-même.
 */

/** Rend lisible une erreur remontée par la base. */
function messageLisible(brut: string): string {
  if (brut.includes("DFF trop éloigné")) {
    return "Renseigne d'abord la « Date fin contrat » sur la fiche avant de passer en « DFF trop éloigné ».";
  }
  return brut;
}

/**
 * Enregistre quelles étapes servent de « vues rapides » (boutons de filtre en
 * haut de la liste). Réservé à la gestion d'équipe ; partagé pour tout le monde.
 */
export async function modifierVuesRapides(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireManage();

  const choisies = new Set(formData.getAll("etapes").map(String));
  const admin = createAdminClient();

  for (const s of PROSPECT_STAGES) {
    const { error } = await admin
      .from("prospect_stages")
      .update({ quick_filter: choisies.has(s.label) })
      .eq("label", s.label);
    if (error) return { ok: false, message: `Échec : ${error.message}` };
  }

  revalidatePath("/prospection");
  return { ok: true, message: "Vues rapides mises à jour." };
}

export async function changerEtape(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!id || !stage) return { ok: false, message: "Prospect introuvable." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("prospects")
    .update({ stage })
    .eq("id", id);

  if (error) return { ok: false, message: messageLisible(error.message) };

  revalidatePath("/prospection");
  revalidatePath(`/prospection/${id}`);
  return { ok: true, message: `Étape : ${stage}` };
}

export async function enregistrerProchaineAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const id = String(formData.get("id") ?? "");
  const texte = String(formData.get("next_action") ?? "").trim();
  const date = String(formData.get("next_action_date") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("prospects")
    .update({
      next_action: texte || null,
      next_action_date: date || null,
    })
    .eq("id", id);

  if (error) return { ok: false, message: messageLisible(error.message) };

  revalidatePath("/prospection");
  return { ok: true, message: "Enregistré." };
}

/** Champs de la fiche que l'utilisateur peut modifier. */
const CHAMPS_FICHE = [
  "nom", "prenom", "mail", "tel_mobile", "tel_fixe",
  "raison_sociale", "siren", "naf", "code_postal", "segment",
  "pdl", "pce", "option_tarifaire",
  "fournisseur_electricite", "fournisseur_gaz", "notes", "next_action",
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

export async function enregistrerFiche(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Prospect introuvable." };

  const patch = lireFormulaire(formData);
  const supabase = await createClient();
  const { error } = await supabase
    .from("prospects")
    .update(patch)
    .eq("id", id);

  if (error) return { ok: false, message: messageLisible(error.message) };

  revalidatePath("/prospection");
  revalidatePath(`/prospection/${id}`);
  return { ok: true, message: "Fiche enregistrée." };
}

export async function creerProspect(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profil = await requireProfile();

  const patch = lireFormulaire(formData);
  if (!patch.raison_sociale && !patch.nom && !patch.prenom) {
    return {
      ok: false,
      message: "Renseigne au moins une raison sociale ou un nom.",
    };
  }

  const supabase = await createClient();

  const proprietaire =
    profil.role === "admin"
      ? String(formData.get("assigned_to") ?? "").trim() || null
      : profil.id;

  const { data, error } = await supabase
    .from("prospects")
    .insert({ ...patch, assigned_to: proprietaire, created_by: profil.id })
    .select("id")
    .single();

  if (error) return { ok: false, message: messageLisible(error.message) };

  revalidatePath("/prospection");
  redirect(`/prospection/${data.id}`);
}
