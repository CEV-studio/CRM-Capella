/**
 * Nom affichable d'un contact, à partir des champs Nom et Prénom séparés.
 * Repli sur la raison sociale (ou « (sans nom) ») si les deux sont vides.
 */
export function nomComplet(
  nom: string | null | undefined,
  prenom: string | null | undefined,
  fallback?: string | null,
): string {
  const complet = [prenom, nom]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return complet || (fallback ?? "").trim() || "(sans nom)";
}
