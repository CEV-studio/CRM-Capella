"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireManage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/action-result";

/**
 * Toutes ces actions utilisent la clé de service, qui ignore RLS.
 * Chacune commence donc OBLIGATOIREMENT par requireManage() : seul un
 * admin ou un délégué « gérer l'équipe » peut les exécuter.
 */

/**
 * Mot de passe provisoire lisible à voix haute et sans ambiguïté :
 * ni O/0, ni I/l/1. Format « Capella-XXXX-XXXX ».
 */
function genererMotDePasse(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bloc = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `Capella-${bloc()}-${bloc()}`;
}

export async function creerCommercial(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireManage();

  const nom = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const tauxBrut = String(formData.get("commission_rate") ?? "").replace(",", ".");
  const taux = Number(tauxBrut);

  if (!nom) return { ok: false, message: "Le nom est obligatoire." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, message: "L'adresse email n'est pas valide." };
  if (!Number.isFinite(taux) || taux < 0 || taux > 100)
    return { ok: false, message: "Le taux doit être un nombre entre 0 et 100." };

  const admin = createAdminClient();
  const motDePasse = genererMotDePasse();

  const { error } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true, // pas d'email de confirmation : Jeremy transmet lui-même
    user_metadata: {
      full_name: nom,
      role: "commercial",
      commission_rate: taux / 100,
      must_change_password: true,
    },
  });

  if (error) {
    const dejaPris =
      error.message.toLowerCase().includes("already") ||
      error.message.toLowerCase().includes("registered");
    return {
      ok: false,
      message: dejaPris
        ? `Un compte existe déjà avec l'adresse ${email}.`
        : `Création impossible : ${error.message}`,
    };
  }

  revalidatePath("/admin/commerciaux");
  return {
    ok: true,
    message: `Compte créé pour ${nom}.`,
    motDePasse,
  };
}

export async function reinitialiserMotDePasse(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireManage();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Commercial introuvable." };

  const admin = createAdminClient();
  const motDePasse = genererMotDePasse();

  const { error } = await admin.auth.admin.updateUserById(id, {
    password: motDePasse,
  });
  if (error) return { ok: false, message: `Échec : ${error.message}` };

  // Il devra le changer dès sa prochaine connexion.
  const { error: errProfil } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", id);
  if (errProfil) return { ok: false, message: `Échec : ${errProfil.message}` };

  revalidatePath("/admin/commerciaux");
  return {
    ok: true,
    message: "Nouveau mot de passe provisoire généré.",
    motDePasse,
  };
}

export async function basculerActivation(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const moi = await requireManage();

  const id = String(formData.get("id") ?? "");
  const actifDemande = String(formData.get("actif")) === "true";

  if (id === moi.id) {
    return { ok: false, message: "Tu ne peux pas désactiver ton propre compte." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: actifDemande })
    .eq("id", id);

  if (error) return { ok: false, message: `Échec : ${error.message}` };

  revalidatePath("/admin/commerciaux");
  return {
    ok: true,
    message: actifDemande
      ? "Compte réactivé."
      : "Compte désactivé : cette personne ne voit plus aucune donnée.",
  };
}

export async function modifierTaux(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireManage();

  const id = String(formData.get("id") ?? "");
  const taux = Number(String(formData.get("commission_rate") ?? "").replace(",", "."));

  if (!Number.isFinite(taux) || taux < 0 || taux > 100)
    return { ok: false, message: "Le taux doit être un nombre entre 0 et 100." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ commission_rate: taux / 100 })
    .eq("id", id);

  if (error) return { ok: false, message: `Échec : ${error.message}` };

  revalidatePath("/admin/commerciaux");
  return { ok: true, message: `Taux mis à jour : ${taux} %.` };
}

/** Active ou désactive les trois permissions d'un commercial. */
export async function modifierPermissions(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const moi = await requireManage();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Commercial introuvable." };

  const patch = {
    can_export: formData.get("can_export") === "on",
    can_view_all: formData.get("can_view_all") === "on",
    can_manage_team: formData.get("can_manage_team") === "on",
  };

  // Sécurité : personne ne peut retirer « gérer l'équipe » à son propre
  // compte et se bloquer dehors.
  if (id === moi.id && !patch.can_manage_team && moi.role !== "admin") {
    return {
      ok: false,
      message: "Tu ne peux pas retirer « gérer l'équipe » à ton propre compte.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(patch).eq("id", id);
  if (error) return { ok: false, message: `Échec : ${error.message}` };

  revalidatePath("/admin/commerciaux");
  return { ok: true, message: "Permissions mises à jour." };
}
