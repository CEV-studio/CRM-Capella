"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";

/**
 * Chaque utilisateur change son propre mot de passe, avec sa propre session.
 * Aucune clé d'administration ici : personne ne peut viser le compte d'un autre.
 */
export async function changerMonMotDePasse(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const motDePasse = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (motDePasse.length < 10)
    return { ok: false, message: "Le mot de passe doit faire au moins 10 caractères." };
  if (motDePasse !== confirmation)
    return { ok: false, message: "Les deux mots de passe ne sont pas identiques." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expirée, reconnecte-toi." };

  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) {
    const memeMotDePasse = error.message
      .toLowerCase()
      .includes("should be different");
    return {
      ok: false,
      message: memeMotDePasse
        ? "Choisis un mot de passe différent du provisoire."
        : `Échec : ${error.message}`,
    };
  }

  const { error: errProfil } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  if (errProfil) return { ok: false, message: `Échec : ${errProfil.message}` };

  return { ok: true, message: "Mot de passe enregistré." };
}
