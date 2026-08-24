/**
 * Affaires de démonstration réparties sur l'année, pour voir vivre le
 * tableau de bord et les commissions avant la migration réelle.
 *
 *   node scripts/affaires-de-test.mjs creer
 *   node scripts/affaires-de-test.mjs supprimer
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const PREFIXE = "DEMO — ";
const annee = new Date().getFullYear();

const AFFAIRES = [
  { nom: "SCIERIE DU BOCAGE", mois: 1, commission: 1800, stage: "Signé", type: "Électricité" },
  { nom: "TRAITEUR MARTIN", mois: 2, commission: 950, stage: "Signé", type: "Gaz" },
  { nom: "GROUPE VELOCE", mois: 3, commission: 4200, stage: "Signé", type: "Élec+Gaz", apporteur: true },
  { nom: "EHPAD LES TILLEULS", mois: 3, commission: 3100, stage: "Signé", type: "Électricité" },
  { nom: "BOUCHERIE CENTRALE", mois: 5, commission: 720, stage: "Signé", type: "Électricité" },
  { nom: "LOGISTIQUE OUEST", mois: 6, commission: 5600, stage: "Signé", type: "Élec+Gaz", apporteur: true },
  { nom: "SALLE DE SPORT PULSE", mois: 7, commission: 1400, stage: "Signé", type: "Électricité" },
  { nom: "PLASTURGIE VENDEENNE", mois: null, commission: 6200, stage: "Comparatif", type: "Élec+Gaz" },
  { nom: "CAVE COOPERATIVE", mois: null, commission: 2300, stage: "RDV", type: "Électricité" },
  { nom: "PRESSING DU CENTRE", mois: null, commission: 480, stage: "KO", type: "Électricité" },
];

const action = process.argv[2];

if (action === "creer") {
  const { data: admin } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .single();

  await supabase.from("affaires").delete().like("raison_sociale", `${PREFIXE}%`);

  // Un apporteur de démonstration, pour que la page commissions ait
  // quelque chose à montrer côté rémunération externe.
  let apporteurId = null;
  const { data: existant } = await supabase
    .from("apporteurs")
    .select("id")
    .eq("name", "DEMO — Réseau partenaires")
    .maybeSingle();

  if (existant) {
    apporteurId = existant.id;
  } else {
    const { data } = await supabase
      .from("apporteurs")
      .insert({
        name: "DEMO — Réseau partenaires",
        contact: "contact@reseau-partenaires.fr",
        commission_rate: 0.15,
        payment_status: "À payer",
      })
      .select("id")
      .single();
    apporteurId = data?.id ?? null;
  }

  const lignes = AFFAIRES.map((a) => ({
    raison_sociale: PREFIXE + a.nom,
    commercial_id: admin.id,
    apporteur_id: a.apporteur ? apporteurId : null,
    stage: a.stage,
    type_energie: a.type,
    commission: a.commission,
    date_entree: `${annee}-${String(Math.max(1, (a.mois ?? 1) - 1)).padStart(2, "0")}-05`,
    date_signature: a.mois
      ? `${annee}-${String(a.mois).padStart(2, "0")}-15`
      : null,
    created_by: admin.id,
  }));

  const { data, error } = await supabase.from("affaires").insert(lignes).select("id");
  if (error) throw error;
  console.log(`${data.length} affaires de démonstration créées sur ${annee}.`);
} else if (action === "supprimer") {
  const { data, error } = await supabase
    .from("affaires")
    .delete()
    .like("raison_sociale", `${PREFIXE}%`)
    .select("id");
  if (error) throw error;
  await supabase.from("apporteurs").delete().like("name", `${PREFIXE}%`);
  console.log(`${data.length} affaire(s) de démonstration supprimée(s).`);
} else {
  console.error("usage : node scripts/affaires-de-test.mjs creer|supprimer");
  process.exit(1);
}
