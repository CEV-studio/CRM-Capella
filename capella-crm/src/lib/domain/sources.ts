/**
 * Types de source (canaux d'acquisition) proposés à la création.
 * Miroir de l'enum `kind` de la table `sources` (voir 0001_schema.sql).
 */
export const TYPES_SOURCE = [
  { valeur: "call_center", libelle: "Call center" },
  { valeur: "apporteur", libelle: "Apporteur" },
  { valeur: "fichier", libelle: "Fichier acheté" },
  { valeur: "web", libelle: "Site web" },
  { valeur: "autre", libelle: "Autre" },
] as const;

export const VALEURS_TYPE_SOURCE = TYPES_SOURCE.map(
  (t) => t.valeur,
) as readonly string[];
