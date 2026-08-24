/**
 * Transforme un libellé de champ personnalisé en clé stable : minuscules,
 * sans accents, seuls lettres/chiffres, séparés par des tirets bas.
 * Ex. « Marge souhaitée (%) » -> « marge_souhaitee ».
 */
export function cleChamp(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Préfixe des valeurs de mapping d'import qui visent un champ personnalisé. */
export const PREFIXE_PERSO = "perso:";
