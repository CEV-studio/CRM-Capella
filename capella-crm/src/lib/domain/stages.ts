/**
 * Étapes du CRM — libellés strictement identiques à l'ancien Google Sheets.
 * Ne jamais renommer : les commerciaux les connaissent par cœur.
 *
 * La `category` sert aux filtres et aux KPI ; elle n'est pas affichée telle quelle.
 */

export const PROSPECT_STAGES = [
  { label: "NRP", category: "actif", color: "#FFF3CD" },
  { label: "Rappels", category: "actif", color: "#FFF3CD" },
  { label: "Demande de facture", category: "actif", color: "#E3EFFF" },
  { label: "Demande ACD", category: "actif", color: "#E3EFFF" },
  { label: "RDV comparatif", category: "a_transferer", color: "#E3F5EE" },
  { label: "Présentation", category: "a_transferer", color: "#E3EFFF" },
  { label: "RIB", category: "a_transferer", color: "#E3F5EE" },
  { label: "DFF trop éloigné", category: "clos", color: "#FFD9D9" },
  { label: "KO", category: "clos", color: "#FFD9D9" },
  { label: "Numéro KO", category: "clos", color: "#FFD9D9" },
  { label: "Pas intéressé", category: "clos", color: "#FFD9D9" },
] as const;

export const AFFAIRE_STAGES = [
  { label: "Demande de cotation", category: "actif", color: "#E3EFFF" },
  { label: "Comparatif", category: "actif", color: "#E3EFFF" },
  { label: "RDV", category: "actif", color: "#E3F5EE" },
  { label: "RIB", category: "actif", color: "#E3F5EE" },
  { label: "Signé", category: "gagne", color: "#C6EFCE" },
  { label: "KO", category: "perdu", color: "#FFD9D9" },
] as const;

export type ProspectStage = (typeof PROSPECT_STAGES)[number]["label"];
export type AffaireStage = (typeof AFFAIRE_STAGES)[number]["label"];

export type ProspectCategory = (typeof PROSPECT_STAGES)[number]["category"];

/** Libellés lisibles des catégories de prospection, pour les filtres. */
export const PROSPECT_CATEGORY_LABELS: Record<ProspectCategory, string> = {
  actif: "En travail",
  a_transferer: "À transférer",
  clos: "Clos",
};

export const TYPES_ENERGIE = ["Électricité", "Gaz", "Élec+Gaz"] as const;

export const FOURNISSEURS = [
  "Vattenfall",
  "Engie",
  "TotalEnergies",
  "EDF",
  "Primeo",
  "Alpiq",
  "Axpo",
  "Endesa",
  "Eneffic",
  "Dyneff",
  "Autre",
] as const;

export const STATUTS_PAIEMENT = ["À payer", "Payé", "En attente"] as const;

const PROSPECT_STAGE_INDEX = new Map(PROSPECT_STAGES.map((s) => [s.label, s]));
const AFFAIRE_STAGE_INDEX = new Map(AFFAIRE_STAGES.map((s) => [s.label, s]));

export function prospectStage(label: string) {
  return PROSPECT_STAGE_INDEX.get(label as ProspectStage);
}

export function affaireStage(label: string) {
  return AFFAIRE_STAGE_INDEX.get(label as AffaireStage);
}

/** Couleur de fond d'une ligne selon son étape. Blanc si l'étape est inconnue. */
export function stageColor(label: string, kind: "prospect" | "affaire") {
  const stage =
    kind === "prospect" ? prospectStage(label) : affaireStage(label);
  return stage?.color ?? "#FFFFFF";
}

/** Un prospect à cette étape est prêt à devenir une affaire. */
export function isTransferable(label: string) {
  return prospectStage(label)?.category === "a_transferer";
}
