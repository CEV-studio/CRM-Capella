/**
 * Template d'import des prospects — DÉCISION FERME : colonnes fixes,
 * pas de correspondance libre à la main.
 *
 * Jeremy télécharge ce modèle, colle ses fichiers dedans, importe.
 * L'ordre des colonnes n'a pas d'importance ; leur intitulé, si.
 */

import type { ProspectInsert } from "./database.types";

export type Colonne = {
  /** Intitulé exact attendu dans le fichier. */
  entete: string;
  /** Colonne correspondante en base. */
  champ: keyof ProspectInsert;
  /** Exemple montré dans le modèle téléchargeable. */
  exemple: string;
  type?: "texte" | "date" | "entier" | "decimal";
};

export const COLONNES_IMPORT: Colonne[] = [
  { entete: "Raison Sociale", champ: "raison_sociale", exemple: "BOULANGERIE DU PORT" },
  { entete: "Nom", champ: "nom", exemple: "Vidal" },
  { entete: "Prénom", champ: "prenom", exemple: "Marc" },
  { entete: "Mail", champ: "mail", exemple: "contact@boulangerie.fr" },
  { entete: "Tel Mobile", champ: "tel_mobile", exemple: "06 12 34 56 78" },
  { entete: "Tel Fixe", champ: "tel_fixe", exemple: "05 46 00 00 00" },
  { entete: "SIREN", champ: "siren", exemple: "812345678" },
  { entete: "PDL", champ: "pdl", exemple: "01234567890123" },
  { entete: "PCE", champ: "pce", exemple: "" },
  { entete: "CAR Électricité", champ: "car_electricite", exemple: "120", type: "decimal" },
  { entete: "CAR Gaz", champ: "car_gaz", exemple: "", type: "decimal" },
  { entete: "Option tarifaire", champ: "option_tarifaire", exemple: "BTINFCU4" },
  { entete: "Code postal", champ: "code_postal", exemple: "17000" },
  { entete: "NAF", champ: "naf", exemple: "1071C" },
  { entete: "Nb sites", champ: "nb_sites", exemple: "1", type: "entier" },
  { entete: "Segment", champ: "segment", exemple: "Restauration" },
  { entete: "Fournisseur Élec", champ: "fournisseur_electricite", exemple: "EDF" },
  { entete: "Fournisseur Gaz", champ: "fournisseur_gaz", exemple: "" },
  { entete: "Date fin contrat", champ: "date_fin_contrat", exemple: "31/12/2026", type: "date" },
  { entete: "Notes", champ: "notes", exemple: "Rappeler le matin" },
  { entete: "Prochaine action", champ: "next_action", exemple: "Premier appel" },
];

export const ENTETES_IMPORT = COLONNES_IMPORT.map((c) => c.entete);
export const EXEMPLE_IMPORT = COLONNES_IMPORT.map((c) => c.exemple);

/** Compare deux intitulés sans se soucier des accents, casse et espaces. */
function normaliserEntete(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const PAR_ENTETE = new Map(
  COLONNES_IMPORT.map((c) => [normaliserEntete(c.entete), c]),
);

export function colonnePourEntete(entete: string): Colonne | undefined {
  return PAR_ENTETE.get(normaliserEntete(entete));
}

const PAR_CHAMP = new Map(COLONNES_IMPORT.map((c) => [c.champ as string, c]));

/** Retrouve une colonne du CRM par son nom technique (pour le mapping manuel). */
export function colonneParChamp(champ: string): Colonne | undefined {
  return PAR_CHAMP.get(champ);
}

/**
 * Convertit une date saisie à la française (31/12/2026) ou au format ISO
 * en date ISO. Renvoie null si la valeur est inexploitable.
 */
export function lireDate(valeur: string): string | null {
  const v = valeur.trim();
  if (!v) return null;

  let iso: string | null = null;

  const fr = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (fr) {
    const [, j, m, a] = fr;
    const annee = a.length === 2 ? `20${a}` : a.padStart(4, "0");
    iso = `${annee}-${m.padStart(2, "0")}-${j.padStart(2, "0")}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    iso = v;
  }

  if (!iso) return null;

  // La forme ne suffit pas : « 32/13/2026 » a l'air d'une date mais n'existe
  // pas. On la reconstruit pour vérifier que le calendrier la reconnaît —
  // sinon la base rejetterait la ligne et ferait échouer tout l'import.
  const [annee, mois, jour] = iso.split("-").map(Number);
  const controle = new Date(Date.UTC(annee, mois - 1, jour));
  const existe =
    controle.getUTCFullYear() === annee &&
    controle.getUTCMonth() === mois - 1 &&
    controle.getUTCDate() === jour;

  return existe ? iso : null;
}
