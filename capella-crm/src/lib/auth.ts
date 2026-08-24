import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/domain/database.types";

/**
 * Renvoie le profil de l'utilisateur connecté, ou redirige vers la connexion.
 * Un compte désactivé est traité comme non connecté.
 *
 * Enveloppé dans `cache()` de React : au sein d'une même requête (layout +
 * page + éventuels composants), la vérification d'identité et la lecture du
 * profil ne se font qu'UNE fois, puis sont réutilisées.
 */
export const requireProfile = cache(async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();

  // Même vérification cryptographique que dans le proxy, sans appel Auth
  // distant systématique. La lecture du profil actif ci-dessous reste le
  // contrôle applicatif qui refuse immédiatement un compte désactivé.
  const { data: token } = await supabase.auth.getClaims();
  const userId = typeof token?.claims?.sub === "string" ? token.claims.sub : null;

  if (!userId) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/connexion?motif=compte-desactive");
  }

  return profile as Profile;
});

/** Vrai si ce profil a des droits d'administration (fondateur ou délégué). */
export function estAdmin(profile: Profile): boolean {
  return profile.role === "admin";
}

/** Vrai si ce profil peut gérer l'équipe (admin ou droit « gérer l'équipe »). */
export function peutGerer(profile: Profile): boolean {
  return profile.role === "admin" || profile.can_manage_team;
}

/** Vrai si ce profil voit les données de toute l'équipe. */
export function voitTout(profile: Profile): boolean {
  return profile.role === "admin" || profile.can_view_all;
}

/** Vrai si ce profil peut supprimer des leads (même droit que la gestion). */
export function peutSupprimer(profile: Profile): boolean {
  return peutGerer(profile);
}

/**
 * Garde-fou pour les opérations strictement réservées au fondateur.
 * À appeler AVANT chaque usage du client d'administration.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!estAdmin(profile)) {
    redirect("/?motif=acces-refuse");
  }
  return profile;
}

/**
 * Garde-fou pour la gestion d'équipe : création de comptes, réservoir,
 * attribution, corbeille. Admin OU commercial avec « gérer l'équipe ».
 */
export async function requireManage(): Promise<Profile> {
  const profile = await requireProfile();
  if (!peutGerer(profile)) {
    redirect("/?motif=acces-refuse");
  }
  return profile;
}

/** Garde-fou pour l'export CSV : admin OU commercial avec « exporter ». */
export async function requireExport(): Promise<Profile> {
  const profile = await requireProfile();
  if (!estAdmin(profile) && !profile.can_export) {
    redirect("/?motif=acces-refuse");
  }
  return profile;
}
