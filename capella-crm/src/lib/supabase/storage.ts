/** Constantes et règles du stockage des pièces jointes (Supabase Storage). */

export const BUCKET_PIECES = "pieces-jointes";

/** Formats acceptés pour une pièce jointe. */
export const MIME_AUTORISES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

/** Taille maximale d'un fichier : 10 Mo. */
export const TAILLE_MAX = 10 * 1024 * 1024;

/**
 * Chemin d'un fichier dans le bucket.
 * Le 1er segment (prospects / affaires) et l'UUID servent aux règles de
 * sécurité côté base : ne pas changer ce format sans adapter la migration.
 */
export function cheminPiece(
  scope: "prospect" | "affaire",
  id: string,
  fileName: string,
): string {
  const dossier = scope === "prospect" ? "prospects" : "affaires";
  const sain = fileName.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120);
  return `${dossier}/${id}/${crypto.randomUUID()}-${sain}`;
}

export function mimeAutorise(mime: string): boolean {
  return (MIME_AUTORISES as readonly string[]).includes(mime);
}
