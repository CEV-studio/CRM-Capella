"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireManage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleChamp } from "@/lib/domain/champs";
import { parseCsv } from "@/lib/csv";
import {
  COLONNES_IMPORT,
  colonneParChamp,
  colonnePourEntete,
  lireDate,
  type Colonne,
} from "@/lib/domain/import-template";
import { PREFIXE_PERSO } from "@/lib/domain/champs";
import { normalizeDigits, normalizePhone } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import { VALEURS_TYPE_SOURCE } from "@/lib/domain/sources";
import type { ProspectInsert, Source } from "@/lib/domain/database.types";

/**
 * Réservoir de leads : import, dédoublonnage, attribution.
 * Réservé à l'admin — chaque action commence par requireAdmin().
 */

export type Doublon = {
  /** Ce qui a déclenché la détection. */
  cle: "SIREN" | "PDL" | "PCE" | "Mobile";
  valeur: string;
  /** Où se trouve le prospect déjà connu. */
  ou: "reservoir" | "attribue" | "fichier";
  detenteur: string | null;
  refExistant: string | null;
};

export type LigneAnalysee = {
  numero: number;
  donnees: ProspectInsert;
  apercu: string;
  doublons: Doublon[];
  erreur?: string;
};

export type RapportImport = {
  ok: true;
  entetesInconnues: string[];
  entetesManquantes: string[];
  lignes: LigneAnalysee[];
};

export type ResultatAnalyse = RapportImport | { ok: false; message: string };

const MAX_LIGNES = 5000;

/**
 * Étape 1 de l'import : on lit le fichier, on repère les doublons,
 * et on rend la main. RIEN n'est écrit en base à ce stade.
 */
export async function analyserImport(
  _prev: ResultatAnalyse | null,
  formData: FormData,
): Promise<ResultatAnalyse> {
  await requireAdmin();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Choisis un fichier CSV." };
  }

  const lignesBrutes = parseCsv(await fichier.text());
  if (lignesBrutes.length < 2) {
    return {
      ok: false,
      message: "Le fichier ne contient pas de données sous la ligne d'en-tête.",
    };
  }

  // Mapping manuel éventuel : intitulé de colonne du fichier -> champ du CRM.
  // (Renvoyé par le navigateur quand l'admin rattache une colonne inconnue.)
  let mapping: Record<string, string> = {};
  try {
    mapping = JSON.parse(String(formData.get("mapping") ?? "{}")) || {};
  } catch {
    mapping = {};
  }

  // Une colonne du fichier peut viser : une colonne du CRM (Colonne), un champ
  // personnalisé ({ perso: clé }), ou rien (undefined = ignorée).
  type ColonneCible = Colonne | { perso: string } | undefined;
  const entetes = lignesBrutes[0];
  const colonnes: ColonneCible[] = entetes.map((e) => {
    const auto = colonnePourEntete(e);
    if (auto) return auto;
    const champ = mapping[e.trim()];
    if (!champ || champ === "ignore") return undefined;
    if (champ.startsWith(PREFIXE_PERSO)) {
      return { perso: champ.slice(PREFIXE_PERSO.length) };
    }
    return colonneParChamp(champ);
  });
  const entetesInconnues = entetes.filter((e, i) => e.trim() && !colonnes[i]);
  const reconnues = new Set(
    colonnes
      .filter((c): c is Colonne => !!c && "entete" in c)
      .map((c) => c.entete),
  );
  const entetesManquantes = COLONNES_IMPORT.map((c) => c.entete).filter(
    (e) => !reconnues.has(e),
  );

  if (reconnues.size === 0) {
    return {
      ok: false,
      message:
        "Aucune colonne reconnue. Repars du modèle téléchargeable : les intitulés doivent être ceux du modèle.",
    };
  }

  const corps = lignesBrutes.slice(1, MAX_LIGNES + 1);

  // --- Lecture des lignes -------------------------------------------
  const lignes: LigneAnalysee[] = corps.map((cellules, index) => {
    const donnees: Record<string, unknown> = {};
    let erreur: string | undefined;

    cellules.forEach((valeur, i) => {
      const colonne = colonnes[i];
      if (!colonne) return;
      const v = valeur.trim();
      if (!v) return;

      // Champ personnalisé : la valeur est rangée dans le JSON champs_perso.
      if ("perso" in colonne) {
        const cp = (donnees.champs_perso ??= {}) as Record<string, string>;
        cp[colonne.perso] = v;
        return;
      }

      if (colonne.type === "date") {
        const d = lireDate(v);
        if (!d) erreur = `Date « ${v} » illisible (attendu : 31/12/2026).`;
        else donnees[colonne.champ] = d;
      } else if (colonne.type === "entier") {
        const n = Number(v.replace(/\s/g, ""));
        if (Number.isFinite(n)) donnees[colonne.champ] = Math.trunc(n);
      } else if (colonne.type === "decimal") {
        const n = Number(v.replace(/\s/g, "").replace(",", "."));
        if (Number.isFinite(n)) donnees[colonne.champ] = n;
      } else {
        donnees[colonne.champ] = v;
      }
    });

    const apercu =
      (donnees.raison_sociale as string) ||
      [donnees.prenom, donnees.nom].filter(Boolean).join(" ") ||
      "(sans nom)";

    if (!donnees.raison_sociale && !donnees.nom && !donnees.prenom) {
      erreur = "Ni raison sociale ni nom : ligne inexploitable.";
    }

    return {
      numero: index + 2, // +2 : ligne 1 = en-têtes, et on compte à partir de 1
      donnees: donnees as ProspectInsert,
      apercu,
      doublons: [],
      erreur,
    };
  });

  // --- Détection des doublons ---------------------------------------
  const clesDe = (d: ProspectInsert) => ({
    SIREN: normalizeDigits(d.siren ?? null),
    PDL: normalizeDigits(d.pdl ?? null),
    PCE: normalizeDigits(d.pce ?? null),
    Mobile: normalizePhone(d.tel_mobile ?? null),
  });

  const toutes = lignes.map((l) => clesDe(l.donnees));
  const valeursUniques = (nom: keyof ReturnType<typeof clesDe>) =>
    [...new Set(toutes.map((c) => c[nom]).filter((v): v is string => !!v))];

  const admin = createAdminClient();
  const colonneBase = {
    SIREN: "siren_norm",
    PDL: "pdl_norm",
    PCE: "pce_norm",
    Mobile: "mobile_norm",
  } as const;

  // Un index par clé : valeur normalisée -> prospect déjà en base.
  const dejaEnBase = new Map<
    string,
    { ref: string | null; assigned_to: string | null }
  >();

  for (const cle of ["SIREN", "PDL", "PCE", "Mobile"] as const) {
    const valeurs = valeursUniques(cle);
    if (valeurs.length === 0) continue;

    // Par paquets : une requête « in » ne doit pas être infinie.
    for (let i = 0; i < valeurs.length; i += 200) {
      const paquet = valeurs.slice(i, i + 200);
      const { data } = await admin
        .from("prospects")
        .select(`ref, assigned_to, ${colonneBase[cle]}`)
        .is("deleted_at", null)
        .in(colonneBase[cle], paquet);

      for (const p of (data ?? []) as unknown as Record<string, string | null>[]) {
        const v = p[colonneBase[cle]];
        if (v) dejaEnBase.set(`${cle}:${v}`, {
          ref: p.ref,
          assigned_to: p.assigned_to,
        });
      }
    }
  }

  // Noms des commerciaux, pour dire chez qui se trouve le doublon.
  const { data: profils } = await admin.from("profiles").select("id, full_name");
  const nomDe = new Map((profils ?? []).map((p) => [p.id, p.full_name]));

  // Doublons internes au fichier : première occurrence gagne.
  const vuDansFichier = new Map<string, string>();

  lignes.forEach((ligne, index) => {
    const cles = toutes[index];
    for (const cle of ["SIREN", "PDL", "PCE", "Mobile"] as const) {
      const valeur = cles[cle];
      if (!valeur) continue;
      const index2 = `${cle}:${valeur}`;

      const enBase = dejaEnBase.get(index2);
      if (enBase) {
        ligne.doublons.push({
          cle,
          valeur,
          ou: enBase.assigned_to ? "attribue" : "reservoir",
          detenteur: enBase.assigned_to
            ? (nomDe.get(enBase.assigned_to) ?? "un commercial")
            : null,
          refExistant: enBase.ref,
        });
        continue;
      }

      const precedent = vuDansFichier.get(index2);
      if (precedent) {
        ligne.doublons.push({
          cle,
          valeur,
          ou: "fichier",
          detenteur: precedent,
          refExistant: null,
        });
      } else {
        vuDansFichier.set(index2, ligne.apercu);
      }
    }
  });

  return { ok: true, entetesInconnues, entetesManquantes, lignes };
}

/**
 * Étape 2 de l'import : écriture effective des lignes retenues.
 * Les lignes sont renvoyées par le navigateur, telles qu'analysées.
 */
export async function confirmerImport(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const moi = await requireAdmin();

  const sourceId = String(formData.get("source_id") ?? "").trim();
  if (!sourceId) {
    return { ok: false, message: "La source est obligatoire : d'où viennent ces leads ?" };
  }

  const attribueA = String(formData.get("assigned_to") ?? "").trim() || null;

  let aInserer: ProspectInsert[];
  try {
    aInserer = JSON.parse(String(formData.get("lignes") ?? "[]"));
  } catch {
    return { ok: false, message: "Données d'import illisibles, relance l'analyse." };
  }

  if (aInserer.length === 0) {
    return { ok: false, message: "Aucune ligne à importer." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("prospects")
    .insert(
      aInserer.map((l) => ({
        ...l,
        stage: "NRP",
        source_id: sourceId,
        assigned_to: attribueA,
        created_by: moi.id,
      })),
    )
    .select("id");

  if (error) return { ok: false, message: `Import interrompu : ${error.message}` };

  revalidatePath("/admin/reservoir");
  revalidatePath("/prospection");

  return {
    ok: true,
    message: attribueA
      ? `${data.length} prospect(s) importé(s) et attribué(s).`
      : `${data.length} prospect(s) importé(s) dans le réservoir.`,
  };
}

/** Attribue une sélection de leads du réservoir à un commercial. */
export async function attribuerSelection(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const commercial = String(formData.get("commercial") ?? "").trim();
  const ids = formData.getAll("ids").map(String).filter(Boolean);

  if (!commercial) return { ok: false, message: "Choisis un commercial." };
  if (ids.length === 0) return { ok: false, message: "Sélectionne au moins un lead." };

  const admin = createAdminClient();
  // Le filtre « assigned_to is null » garantit qu'on ne prend jamais
  // un lead déjà entre les mains d'un commercial.
  const { data, error } = await admin
    .from("prospects")
    .update({ assigned_to: commercial })
    .in("id", ids)
    .is("assigned_to", null)
    .select("id");

  if (error) return { ok: false, message: `Échec : ${error.message}` };

  revalidatePath("/admin/reservoir");
  revalidatePath("/prospection");
  return { ok: true, message: `${data.length} lead(s) attribué(s).` };
}

/** Attribue d'un coup tous les leads non attribués d'une source. */
export async function attribuerSource(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const commercial = String(formData.get("commercial") ?? "").trim();
  const sourceId = String(formData.get("source_id") ?? "").trim();
  const limite = Number(String(formData.get("limite") ?? "").trim());

  if (!commercial) return { ok: false, message: "Choisis un commercial." };
  if (!sourceId) return { ok: false, message: "Choisis une source." };

  const admin = createAdminClient();

  // Sélection d'abord, mise à jour ensuite : c'est ce qui permet de
  // n'attribuer qu'un lot (« les 50 premiers ») plutôt que tout.
  let requete = admin
    .from("prospects")
    .select("id")
    .is("assigned_to", null)
    .is("deleted_at", null)
    .eq("source_id", sourceId)
    .order("created_at");

  if (Number.isFinite(limite) && limite > 0) requete = requete.limit(limite);

  const { data: cibles, error: errLecture } = await requete;
  if (errLecture) return { ok: false, message: `Échec : ${errLecture.message}` };
  if (!cibles || cibles.length === 0) {
    return { ok: false, message: "Aucun lead disponible pour cette source." };
  }

  const { data, error } = await admin
    .from("prospects")
    .update({ assigned_to: commercial })
    .in("id", cibles.map((c) => c.id))
    .is("assigned_to", null)
    .select("id");

  if (error) return { ok: false, message: `Échec : ${error.message}` };

  revalidatePath("/admin/reservoir");
  revalidatePath("/prospection");
  return { ok: true, message: `${data.length} lead(s) attribué(s).` };
}

/**
 * Réattribution : reprend tout le portefeuille d'un commercial
 * (prospects et affaires) et le passe à un autre — ou au réservoir.
 */
export async function reattribuer(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const depuis = String(formData.get("depuis") ?? "").trim();
  const vers = String(formData.get("vers") ?? "").trim();

  if (!depuis) return { ok: false, message: "Choisis le commercial à vider." };
  if (depuis === vers) {
    return { ok: false, message: "Le commercial de départ et d'arrivée sont identiques." };
  }

  const admin = createAdminClient();

  const { data: prospects, error: errP } = await admin
    .from("prospects")
    .update({ assigned_to: vers || null })
    .eq("assigned_to", depuis)
    .select("id");
  if (errP) return { ok: false, message: `Échec sur les prospects : ${errP.message}` };

  // Une affaire doit toujours avoir un commercial : on ne la renvoie
  // jamais au réservoir, contrairement à un prospect.
  let nbAffaires = 0;
  if (vers) {
    const { data: affaires, error: errA } = await admin
      .from("affaires")
      .update({ commercial_id: vers })
      .eq("commercial_id", depuis)
      .select("id");
    if (errA) return { ok: false, message: `Échec sur les affaires : ${errA.message}` };
    nbAffaires = affaires.length;
  }

  revalidatePath("/admin/reservoir");
  revalidatePath("/prospection");
  revalidatePath("/admin/commerciaux");

  const destination = vers ? "au commercial choisi" : "au réservoir";
  return {
    ok: true,
    message: vers
      ? `${prospects.length} prospect(s) et ${nbAffaires} affaire(s) transféré(s) ${destination}.`
      : `${prospects.length} prospect(s) renvoyé(s) ${destination}. Les affaires n'ont pas bougé : une affaire doit garder un commercial.`,
  };
}

/**
 * Crée une nouvelle source (canal d'acquisition) : un nom + un type.
 * Le nom doit être unique — on refuse un doublon plutôt que d'en créer deux.
 */
export async function creerSource(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();

  if (!name) return { ok: false, message: "Donne un nom à la source." };
  if (!VALEURS_TYPE_SOURCE.includes(kind)) {
    return { ok: false, message: "Choisis un type de source." };
  }

  const admin = createAdminClient();

  const { data: existante } = await admin
    .from("sources")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existante) {
    return { ok: false, message: `La source « ${name} » existe déjà.` };
  }

  const { error } = await admin
    .from("sources")
    .insert({ name, kind: kind as Source["kind"], is_active: true });

  if (error) return { ok: false, message: `Échec : ${error.message}` };

  revalidatePath("/admin/reservoir");
  revalidatePath("/prospection");
  return { ok: true, message: `Source « ${name} » créée.` };
}

/**
 * Crée un champ personnalisé (ex. « Marge souhaitée »). Le libellé donné est
 * transformé en clé stable ; on refuse un doublon de clé. Une fois créé, le
 * champ apparaît sur chaque fiche prospect et dans le rattachement d'import.
 */
export async function creerChampPersonnalise(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireManage();

  const libelle = String(formData.get("libelle") ?? "").trim();
  if (!libelle) return { ok: false, message: "Donne un nom au champ." };

  const cle = cleChamp(libelle);
  if (!cle) {
    return { ok: false, message: "Nom de champ invalide : mets au moins une lettre." };
  }

  const admin = createAdminClient();

  const { data: existant } = await admin
    .from("champs_personnalises")
    .select("id")
    .eq("cle", cle)
    .maybeSingle();
  if (existant) {
    return { ok: false, message: `Un champ « ${libelle} » existe déjà.` };
  }

  const { error } = await admin
    .from("champs_personnalises")
    .insert({ cle, libelle });

  if (error) return { ok: false, message: `Échec : ${error.message}` };

  revalidatePath("/admin/reservoir");
  revalidatePath("/prospection");
  return { ok: true, message: `Champ « ${libelle} » créé.` };
}
