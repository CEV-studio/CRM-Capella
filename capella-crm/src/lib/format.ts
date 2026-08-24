/** Formats d'affichage — français partout, une seule implémentation. */

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const nombre = new Intl.NumberFormat("fr-FR");

const pourcent = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const fmtEuros = (v: number | null | undefined) =>
  v == null ? "—" : euros.format(v);

export const fmtNombre = (v: number | null | undefined) =>
  v == null ? "—" : nombre.format(v);

export const fmtPourcent = (v: number | null | undefined) =>
  v == null ? "—" : pourcent.format(v);

export const fmtDate = (v: string | Date | null | undefined) =>
  v ? dateCourte.format(new Date(v)) : "—";

export const fmtDateHeure = (v: string | Date | null | undefined) =>
  v ? dateHeure.format(new Date(v)) : "—";

export const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
] as const;

/**
 * Abréviations pour les tableaux serrés. Écrites à la main : une troncature
 * mécanique donnerait « Jui » pour juin comme pour juillet.
 */
export const MOIS_COURTS = [
  "Janv", "Févr", "Mars", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sept", "Oct", "Nov", "Déc",
] as const;

/**
 * Normalise un numéro de téléphone comme le fait Postgres :
 * chiffres uniquement, 9 derniers. Sert à détecter les doublons côté client
 * avant même d'envoyer les données.
 */
export function normalizePhone(p: string | null | undefined): string | null {
  const digits = (p ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}

export function normalizeDigits(p: string | null | undefined): string | null {
  const digits = (p ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}
