/**
 * Lecture et écriture de CSV, sans dépendance externe.
 *
 * Contraintes réelles du terrain : les fichiers viennent d'Excel français
 * (séparateur « ; », accents, BOM en tête) ou de Google Sheets (séparateur
 * « , »). Les deux doivent passer sans que personne n'ait à y penser.
 */

/** Devine le séparateur en comparant les occurrences sur la ligne d'en-tête. */
function devinerSeparateur(premiereLigne: string): string {
  const candidats = [";", ",", "\t"];
  let meilleur = ";";
  let score = -1;
  for (const c of candidats) {
    const n = premiereLigne.split(c).length;
    if (n > score) {
      score = n;
      meilleur = c;
    }
  }
  return meilleur;
}

/**
 * Découpe un CSV en tableau de lignes.
 * Gère les guillemets, les guillemets doublés et les retours à la ligne
 * à l'intérieur d'un champ.
 */
export function parseCsv(contenu: string): string[][] {
  // Retrait du BOM que met Excel en début de fichier.
  const texte = contenu.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const finPremiereLigne = texte.indexOf("\n");
  const separateur = devinerSeparateur(
    finPremiereLigne === -1 ? texte : texte.slice(0, finPremiereLigne),
  );

  const lignes: string[][] = [];
  let champ = "";
  let ligne: string[] = [];
  let dansGuillemets = false;

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];

    if (dansGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i++;
        } else {
          dansGuillemets = false;
        }
      } else {
        champ += c;
      }
      continue;
    }

    if (c === '"') {
      dansGuillemets = true;
    } else if (c === separateur) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n") {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else {
      champ += c;
    }
  }

  if (champ !== "" || ligne.length > 0) {
    ligne.push(champ);
    lignes.push(ligne);
  }

  // On écarte les lignes entièrement vides (fréquentes en fin de fichier Excel).
  return lignes.filter((l) => l.some((v) => v.trim() !== ""));
}

/** Échappe une valeur pour l'écriture d'un CSV. */
function echapper(valeur: unknown): string {
  const s = valeur == null ? "" : String(valeur);
  return /["\n;,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Assemble un CSV lisible par Excel français : séparateur « ; » et BOM,
 * sans quoi les accents s'affichent en charabia.
 */
export function toCsv(entetes: string[], lignes: unknown[][]): string {
  const corps = [entetes, ...lignes]
    .map((l) => l.map(echapper).join(";"))
    .join("\r\n");
  return "﻿" + corps;
}
