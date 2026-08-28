/**
 * Calcul des indicateurs et des commissions.
 *
 * Règle métier :
 *   - la colonne « Commission (€) » d'une affaire est ce que Capella encaisse ;
 *   - la part d'un commercial = ce montant × son taux ;
 *   - la part d'un apporteur  = ce montant × son taux.
 * Les commissions signées sont comptabilisées sur le mois de signature.
 * Une commission déjà renseignée sur un dossier non signé reste visible comme
 * « en attente », sans être mélangée à la comptabilité signée.
 */

import type { Affaire } from "./database.types";

export type FiltreDashboard = {
  annee?: number;
  /** 1 à 12, ou undefined pour toute l'année. */
  mois?: number;
  commercialId?: string;
  apporteurId?: string;
};

export function filtrerAffaires(
  affaires: Affaire[],
  f: FiltreDashboard,
): Affaire[] {
  return affaires.filter((a) => {
    if (f.commercialId && a.commercial_id !== f.commercialId) return false;
    if (f.apporteurId && a.apporteur_id !== f.apporteurId) return false;

    // L'année et le mois ne s'appliquent qu'aux affaires signées : une affaire
    // en cours n'a pas encore de date de signature et doit rester visible.
    if ((f.annee || f.mois) && a.stage === "Signé") {
      if (!a.date_signature) return false;
      const d = new Date(a.date_signature);
      if (f.annee && d.getUTCFullYear() !== f.annee) return false;
      if (f.mois && d.getUTCMonth() + 1 !== f.mois) return false;
    }
    return true;
  });
}

export type Indicateurs = {
  caSigne: number;
  caEnAttente: number;
  nbSignees: number;
  nbEnCours: number;
  nbPerdues: number;
  tauxConversion: number;
  relancesAVenir: number;
  commissionsCommerciaux: number;
  commissionsCommerciauxEnAttente: number;
  commissionsApporteurs: number;
};

export function calculerIndicateurs(
  affaires: Affaire[],
  tauxCommercial: Map<string, number>,
  tauxApporteur: Map<string, number>,
): Indicateurs {
  const signees = affaires.filter((a) => a.stage === "Signé");
  const perdues = affaires.filter((a) => a.stage === "KO");
  const enCours = affaires.filter((a) => a.stage !== "Signé" && a.stage !== "KO");
  const avecCommissionEnAttente = enCours.filter((a) => Number(a.commission ?? 0) > 0);

  const caSigne = signees.reduce((s, a) => s + Number(a.commission ?? 0), 0);
  const caEnAttente = avecCommissionEnAttente.reduce((s, a) => s + Number(a.commission ?? 0), 0);

  const commissionsCommerciaux = signees.reduce(
    (s, a) =>
      s + Number(a.commission ?? 0) * (tauxCommercial.get(a.commercial_id) ?? 0),
    0,
  );

  const commissionsCommerciauxEnAttente = avecCommissionEnAttente.reduce(
    (s, a) =>
      s + Number(a.commission ?? 0) * (tauxCommercial.get(a.commercial_id) ?? 0),
    0,
  );

  const commissionsApporteurs = signees.reduce(
    (s, a) =>
      a.apporteur_id
        ? s + Number(a.commission ?? 0) * (tauxApporteur.get(a.apporteur_id) ?? 0)
        : s,
    0,
  );

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const relancesAVenir = affaires.filter(
    (a) => a.date_relance != null && a.date_relance >= aujourdhui,
  ).length;

  return {
    caSigne,
    caEnAttente,
    nbSignees: signees.length,
    nbEnCours: enCours.length,
    nbPerdues: perdues.length,
    tauxConversion: affaires.length > 0 ? signees.length / affaires.length : 0,
    relancesAVenir,
    commissionsCommerciaux,
    commissionsCommerciauxEnAttente,
    commissionsApporteurs,
  };
}

export type LigneMois = {
  mois: number;
  nbSignees: number;
  caSigne: number;
  commissions: number;
};

/** Douze lignes, toujours : un mois sans affaire vaut zéro, pas « absent ». */
export function commissionsParMois(
  affaires: Affaire[],
  annee: number,
  tauxCommercial: Map<string, number>,
): LigneMois[] {
  const lignes: LigneMois[] = Array.from({ length: 12 }, (_, i) => ({
    mois: i + 1,
    nbSignees: 0,
    caSigne: 0,
    commissions: 0,
  }));

  for (const a of affaires) {
    if (a.stage !== "Signé" || !a.date_signature) continue;
    const d = new Date(a.date_signature);
    if (d.getUTCFullYear() !== annee) continue;

    const ligne = lignes[d.getUTCMonth()];
    const montant = Number(a.commission ?? 0);
    ligne.nbSignees += 1;
    ligne.caSigne += montant;
    ligne.commissions += montant * (tauxCommercial.get(a.commercial_id) ?? 0);
  }

  return lignes;
}

/** Années présentes dans les signatures, pour alimenter le filtre. */
export function anneesDisponibles(affaires: Affaire[]): number[] {
  const annees = new Set<number>([new Date().getUTCFullYear()]);
  for (const a of affaires) {
    if (a.date_signature) annees.add(new Date(a.date_signature).getUTCFullYear());
  }
  return [...annees].sort((x, y) => y - x);
}
