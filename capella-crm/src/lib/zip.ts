import { deflateRawSync } from "node:zlib";

/**
 * Écriture d'une archive ZIP, sans dépendance externe.
 *
 * Sert à l'export complet : un seul fichier à télécharger, contenant un CSV
 * par table. Le format ZIP est volontairement traité dans sa forme la plus
 * simple (pas de Zip64, pas de chiffrement) — largement suffisant pour des
 * exports de quelques mégaoctets, et lisible par le Finder comme par Windows.
 */

const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(donnees: Buffer): number {
  let c = -1;
  for (let i = 0; i < donnees.length; i++) {
    c = TABLE_CRC[(c ^ donnees[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

/** Date et heure au format MS-DOS attendu par le format ZIP. */
function dateDos(d: Date): { heure: number; date: number } {
  return {
    heure:
      (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date:
      ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export type FichierZip = { nom: string; contenu: string };

export function creerZip(fichiers: FichierZip[]): Buffer {
  const maintenant = dateDos(new Date());
  const entrees: Buffer[] = [];
  const entetesCentraux: Buffer[] = [];
  let decalage = 0;

  for (const fichier of fichiers) {
    const nom = Buffer.from(fichier.nom, "utf8");
    const brut = Buffer.from(fichier.contenu, "utf8");
    const compresse = deflateRawSync(brut);
    const somme = crc32(brut);

    const enTeteLocal = Buffer.alloc(30);
    enTeteLocal.writeUInt32LE(0x04034b50, 0); // signature
    enTeteLocal.writeUInt16LE(20, 4); // version minimale
    enTeteLocal.writeUInt16LE(0x0800, 6); // drapeau : noms en UTF-8
    enTeteLocal.writeUInt16LE(8, 8); // méthode : deflate
    enTeteLocal.writeUInt16LE(maintenant.heure, 10);
    enTeteLocal.writeUInt16LE(maintenant.date, 12);
    enTeteLocal.writeUInt32LE(somme, 14);
    enTeteLocal.writeUInt32LE(compresse.length, 18);
    enTeteLocal.writeUInt32LE(brut.length, 22);
    enTeteLocal.writeUInt16LE(nom.length, 26);
    enTeteLocal.writeUInt16LE(0, 28); // pas de champ « extra »

    entrees.push(enTeteLocal, nom, compresse);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version d'écriture
    central.writeUInt16LE(20, 6); // version minimale
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(maintenant.heure, 12);
    central.writeUInt16LE(maintenant.date, 14);
    central.writeUInt32LE(somme, 16);
    central.writeUInt32LE(compresse.length, 20);
    central.writeUInt32LE(brut.length, 24);
    central.writeUInt16LE(nom.length, 28);
    central.writeUInt32LE(decalage, 42);

    entetesCentraux.push(central, nom);
    decalage += enTeteLocal.length + nom.length + compresse.length;
  }

  const central = Buffer.concat(entetesCentraux);

  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(central.length, 12);
  fin.writeUInt32LE(decalage, 16);

  return Buffer.concat([...entrees, central, fin]);
}
