/**
 * Outil de vérification — crée ou supprime un compte de test jetable.
 *
 *   node scripts/compte-de-test.mjs creer
 *   node scripts/compte-de-test.mjs supprimer
 *
 * Les comptes de test utilisent le domaine @verif.local : ils sont
 * reconnaissables d'un coup d'œil et supprimés tous ensemble.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Lecture de .env.local sans dépendance externe.
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

const DOMAINE = "@verif.local";
const action = process.argv[2];

async function listerComptesDeTest() {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.filter((u) => u.email?.endsWith(DOMAINE));
}

if (action === "creer") {
  const email = `admin-verif${DOMAINE}`;
  const password = "Verification-Temporaire-2026";

  for (const u of await listerComptesDeTest()) {
    await supabase.auth.admin.deleteUser(u.id);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Compte de vérification",
      role: "admin",
      commission_rate: 1,
      must_change_password: false,
    },
  });
  if (error) throw error;

  console.log("compte créé :", email, "/", password, "id:", data.user.id);
} else if (action === "supprimer") {
  const comptes = await listerComptesDeTest();
  for (const u of comptes) {
    await supabase.auth.admin.deleteUser(u.id);
    console.log("supprimé :", u.email);
  }
  console.log(`${comptes.length} compte(s) de test supprimé(s).`);
} else {
  console.error("usage : node scripts/compte-de-test.mjs creer|supprimer");
  process.exit(1);
}
