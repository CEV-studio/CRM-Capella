/** Étapes métier du CRM. */

export const PROSPECTION_STAGES = [
  { label: "NRP", category: "actif", color: "#FFF3CD" },
  { label: "Rappels", category: "actif", color: "#FFF3CD" },
  { label: "Demande de facture", category: "actif", color: "#E3EFFF" },
  // Étape de transition : dès qu'elle est choisie, la fiche passe dans Clients.
  { label: "Demande ACD", category: "client", color: "#E3EFFF" },
  { label: "DFF trop éloigné", category: "clos", color: "#FFD9D9" },
  { label: "KO", category: "clos", color: "#FFD9D9" },
  { label: "Numéro KO", category: "clos", color: "#FFD9D9" },
  { label: "Pas intéressé", category: "clos", color: "#FFD9D9" },
] as const;

export const CLIENT_STAGES = [
  { label: "Demande ACD", category: "client", color: "#E3EFFF" },
  { label: "RDV comparatif", category: "client", color: "#E3F5EE" },
  { label: "Présentation", category: "client", color: "#E3EFFF" },
  { label: "RIB", category: "client", color: "#E3F5EE" },
  // Étape de transition : crée/bascule le dossier dans Cotations.
  { label: "Demande de cotation", category: "cotation", color: "#E3F5EE" },
  { label: "KO", category: "clos", color: "#FFD9D9" },
] as const;

/** Toutes les étapes possibles d'une fiche relationnelle, pour compatibilité historique. */
export const PROSPECT_STAGES = [
  ...PROSPECTION_STAGES,
  ...CLIENT_STAGES.filter((s) => !PROSPECTION_STAGES.some((p) => p.label === s.label)),
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

export const PROSPECT_CATEGORY_LABELS: Record<string, string> = {
  actif: "En travail",
  client: "Client",
  cotation: "Cotation",
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

export function stageColor(label: string, kind: "prospect" | "affaire") {
  const stage = kind === "prospect" ? prospectStage(label) : affaireStage(label);
  return stage?.color ?? "#FFFFFF";
}

/** Une fiche client à cette étape doit entrer dans le pipeline de cotation. */
export function isTransferable(label: string) {
  return label === "Demande de cotation";
}
