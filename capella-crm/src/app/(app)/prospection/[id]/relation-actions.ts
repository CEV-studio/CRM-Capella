"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeDigits } from "@/lib/format";

const txt = (value: FormDataEntryValue | null) => String(value || "").trim();

async function context(formData: FormData) {
  const profile = await requireProfile();
  const prospectId = txt(formData.get("prospect_id"));
  if (!prospectId) throw new Error("Prospect manquant.");
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prospect } = await (supabase as any).from("prospects").select("id, entreprise_id").eq("id", prospectId).is("deleted_at", null).maybeSingle();
  if (!prospect?.entreprise_id) throw new Error("Entreprise liée introuvable. Recharge la fiche puis réessaie.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { profile, prospectId, entrepriseId:prospect.entreprise_id as string, db:supabase as any };
}

export async function lierContact(formData: FormData) {
  const { prospectId, entrepriseId, db } = await context(formData);
  const prenom = txt(formData.get("prenom"));
  const nom = txt(formData.get("nom"));
  const email = txt(formData.get("email"));
  const telephone = txt(formData.get("telephone"));
  const fonction = txt(formData.get("fonction"));
  if (!prenom && !nom && !email && !telephone) throw new Error("Renseigne au moins un nom, un email ou un téléphone.");

  let contact: { id:string } | null = null;
  if (email) {
    const { data } = await db.from("crm_contacts").select("id").eq("email_norm", email.toLowerCase()).is("archived_at", null).limit(1).maybeSingle();
    contact = data;
  }
  if (!contact && telephone) {
    const { data } = await db.from("crm_contacts").select("id").eq("telephone_norm", normalizeDigits(telephone)).is("archived_at", null).limit(1).maybeSingle();
    contact = data;
  }
  if (!contact) {
    const { data, error } = await db.from("crm_contacts").insert({ prenom:prenom||null, nom:nom||null, email:email||null, telephone:telephone||null }).select("id").single();
    if (error) throw new Error(error.message);
    contact = data;
  }

  if (formData.get("is_primary") === "on") await db.from("contact_entreprises").update({ is_primary:false }).eq("entreprise_id", entrepriseId).is("archived_at", null);
  const { error } = await db.from("contact_entreprises").upsert({
    contact_id:contact!.id,
    entreprise_id:entrepriseId,
    fonction:fonction||null,
    is_primary:formData.get("is_primary") === "on",
    archived_at:null,
  }, { onConflict:"contact_id,entreprise_id" });
  if (error) throw new Error(error.message);
  revalidatePath(`/prospection/${prospectId}`);
}

export async function ajouterCompteurRelationnel(formData: FormData) {
  const { prospectId, entrepriseId, db } = await context(formData);
  const type = txt(formData.get("type_energie"));
  const numero = txt(formData.get("numero"));
  if (!numero || !["electricite", "gaz"].includes(type)) throw new Error("Le type d’énergie et le numéro du compteur sont obligatoires.");
  const { error } = await db.from("prospect_compteurs").insert({
    prospect_id:prospectId,
    entreprise_id:entrepriseId,
    type_energie:type,
    numero,
    siret:txt(formData.get("siret"))||null,
    adresse:txt(formData.get("adresse"))||null,
    code_postal:txt(formData.get("code_postal"))||null,
    ville:txt(formData.get("ville"))||null,
    segment:type === "electricite" ? txt(formData.get("segment"))||null : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/prospection/${prospectId}`);
}

export async function ajouterContratHistorique(formData: FormData) {
  const { profile, prospectId, entrepriseId, db } = await context(formData);
  const compteurId = txt(formData.get("compteur_id"));
  const fournisseur = txt(formData.get("fournisseur"));
  const type = txt(formData.get("type_energie"));
  const dateDebut = txt(formData.get("date_debut"));
  const dateFin = txt(formData.get("date_fin"));
  if (!compteurId || !fournisseur || !dateDebut || !dateFin || !["electricite", "gaz"].includes(type)) throw new Error("Compteur, fournisseur et dates sont obligatoires.");
  if (dateFin < dateDebut) throw new Error("La date de fin doit être postérieure à la date de début.");
  const { data: compteur } = await db.from("prospect_compteurs").select("id").eq("id", compteurId).eq("entreprise_id", entrepriseId).is("archived_at", null).maybeSingle();
  if (!compteur) throw new Error("Compteur inaccessible.");
  const { data: precedent } = await db.from("contrats_energie").select("id").eq("compteur_id", compteurId).is("archived_at", null).order("date_debut", { ascending:false }).limit(1).maybeSingle();
  const prixTexte = txt(formData.get("prix")).replace(",", ".");
  const consommationTexte = txt(formData.get("consommation_mwh")).replace(",", ".");
  const { error } = await db.from("contrats_energie").insert({
    entreprise_id:entrepriseId,
    compteur_id:compteurId,
    contrat_precedent_id:precedent?.id||null,
    fournisseur,
    type_energie:type,
    reference_contrat:txt(formData.get("reference_contrat"))||null,
    date_signature:txt(formData.get("date_signature"))||null,
    date_debut:dateDebut,
    date_fin:dateFin,
    prix:prixTexte ? Number(prixTexte) : null,
    unite_prix:txt(formData.get("unite_prix"))||null,
    details_prix:txt(formData.get("details_prix"))||null,
    consommation_mwh:consommationTexte ? Number(consommationTexte) : null,
    statut:txt(formData.get("statut"))||"signe",
    notes:txt(formData.get("notes"))||null,
    created_by:profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/prospection/${prospectId}`);
}
