/**
 * Jeu de données de démonstration, pour tester les écrans avant la vraie
 * migration depuis Google Sheets.
 *
 *   node scripts/donnees-de-test.mjs creer
 *   node scripts/donnees-de-test.mjs supprimer
 *
 * Toutes les lignes créées ont une raison sociale préfixée « DEMO — »,
 * ce qui permet de toutes les retrouver et les effacer d'un coup.
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

const PROSPECTS = [
  { nom: "BOULANGERIE DU PORT", contact: "Marc Vidal", tel: "06 12 34 56 78", siren: "812345678", stage: "NRP", cp: "17000", segment: "Restauration", fournisseur: "EDF", puissance: "36 kVA" },
  { nom: "GARAGE ATLANTIQUE", contact: "Sonia Bertin", tel: "07 88 21 44 09", siren: "509876543", stage: "Rappels", cp: "17140", segment: "Automobile", fournisseur: "Engie", puissance: "42 kVA", action: "Rappeler après 14h" },
  { nom: "CLINIQUE SAINT-LOUIS", contact: "Dr Amine Haddad", tel: "06 45 78 90 12", siren: "331122334", stage: "Demande de facture", cp: "33000", segment: "Santé", fournisseur: "TotalEnergies", puissance: "250 kVA", action: "Relancer la facture" },
  { nom: "TRANSPORTS MOREAU", contact: "Julien Moreau", tel: "06 77 65 43 21", siren: "422334455", stage: "Demande ACD", cp: "44000", segment: "Logistique", fournisseur: "Vattenfall", puissance: "120 kVA" },
  { nom: "HOTEL DES REMPARTS", contact: "Claire Fontaine", tel: "06 33 22 11 00", siren: "615243678", stage: "RDV comparatif", cp: "17000", segment: "Hôtellerie", fournisseur: "Engie", puissance: "80 kVA", action: "RDV mardi 10h" },
  { nom: "IMPRIMERIE CENTRALE", contact: "Paul Lemaire", tel: "07 12 98 76 54", siren: "718293746", stage: "Présentation", cp: "79000", segment: "Industrie", fournisseur: "Alpiq", puissance: "160 kVA" },
  { nom: "SUPERMARCHE LES PINS", contact: "Nadia Cherif", tel: "06 55 44 33 22", siren: "824135790", stage: "RIB", cp: "85000", segment: "Retail", fournisseur: "Primeo", puissance: "300 kVA", action: "Envoyer le contrat" },
  { nom: "MENUISERIE DUVAL", contact: "Éric Duval", tel: "06 91 82 73 64", siren: "930241586", stage: "DFF trop éloigné", cp: "16000", segment: "Artisanat", fournisseur: "EDF", puissance: "36 kVA", finContrat: "2027-09-30" },
  { nom: "PRESSING EXPRESS", contact: "Lina Rossi", tel: "07 45 67 89 01", siren: "147258369", stage: "Pas intéressé", cp: "17300", segment: "Services", fournisseur: "Autre", puissance: "24 kVA" },
  { nom: "CAMPING LES DUNES", contact: "Hervé Bacri", tel: "06 24 68 10 12", siren: "258369147", stage: "KO", cp: "17110", segment: "Tourisme", fournisseur: "Engie", puissance: "90 kVA" },
];

const action = process.argv[2];

if (action === "creer") {
  const { data: admin } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .single();

  const { data: sources } = await supabase.from("sources").select("id, name");
  const source = (nom) => sources.find((s) => s.name === nom)?.id ?? null;

  await supabase.from("prospects").delete().like("raison_sociale", `${PREFIXE}%`);

  const lignes = PROSPECTS.map((p, i) => ({
    raison_sociale: PREFIXE + p.nom,
    nom: p.contact,
    tel_mobile: p.tel,
    mail: `contact@${p.nom.toLowerCase().replace(/[^a-z]+/g, "-")}.fr`,
    siren: p.siren,
    code_postal: p.cp,
    segment: p.segment,
    fournisseur_electricite: p.fournisseur,
    car_electricite: p.puissance,
    date_fin_contrat: p.finContrat ?? null,
    stage: p.stage,
    next_action: p.action ?? null,
    next_action_date: p.action
      ? new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10)
      : null,
    // Une partie chez l'admin, une partie au réservoir : de quoi vérifier
    // les filtres « commercial » et « réservoir ».
    assigned_to: i % 3 === 2 ? null : admin.id,
    source_id: source(i % 2 === 0 ? "Call center Maroc" : "Fichier acheté"),
    created_by: admin.id,
  }));

  const { data, error } = await supabase.from("prospects").insert(lignes).select("id");
  if (error) throw error;
  console.log(`${data.length} prospects de démonstration créés.`);
} else if (action === "supprimer") {
  let prospects = 0;
  let affaires = 0;

  // « DEMO — » : jeu de démonstration ; « IMPORT — » : lignes du fichier
  // d'exemple utilisé pour vérifier l'import.
  // Les affaires partent en premier : elles pointent vers les prospects.
  for (const prefixe of [PREFIXE, "IMPORT — "]) {
    const { data: a, error: errA } = await supabase
      .from("affaires")
      .delete()
      .like("raison_sociale", `${prefixe}%`)
      .select("id");
    if (errA) throw errA;
    affaires += a.length;

    const { data, error } = await supabase
      .from("prospects")
      .delete()
      .like("raison_sociale", `${prefixe}%`)
      .select("id");
    if (error) throw error;
    prospects += data.length;
  }
  console.log(
    `${prospects} prospect(s) et ${affaires} affaire(s) de démonstration supprimé(s).`,
  );
} else {
  console.error("usage : node scripts/donnees-de-test.mjs creer|supprimer");
  process.exit(1);
}
