/** Puissances distinctes présentes sur une fiche, y compris les fiches multisites. */
export function puissancesDe(valeur: string | null): number[] {
  if (!valeur) return [];
  return [...new Set(valeur.split("·").map((partie) => {
    const match = partie.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:kva)?$/i);
    return match ? Number(match[1].replace(",", ".")) : NaN;
  }).filter((n) => Number.isFinite(n) && n > 0))];
}

/** Expression PostgREST correspondant aux valeurs normalisées du CRM. */
export function filtrePuissance(kva: string): string {
  return [`puissance.eq.${kva}`, `puissance.ilike.${kva} kVA`,
    `puissance.ilike.${kva} kVA · %`, `puissance.ilike.% · ${kva} kVA · %`,
    `puissance.ilike.% · ${kva} kVA`, `puissance.ilike.${kva}kVA`,
    `puissance.ilike.${kva}kVA · %`, `puissance.ilike.% · ${kva}kVA · %`,
    `puissance.ilike.% · ${kva}kVA`].join(",");
}
