import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FicheForm } from "../fiche-form";
import { chargerSources, chargerChampsPersonnalises } from "@/lib/referentiels";
import type { Profile } from "@/lib/domain/database.types";

export const metadata = { title: "Nouveau prospect — Capella CRM" };
export const dynamic = "force-dynamic";

export default async function NouveauProspectPage() {
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";

  const supabase = await createClient();
  const [sources, { data: profils }, champsPerso] = await Promise.all([
    chargerSources(),
    estAdmin
      ? supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[] }),
    chargerChampsPersonnalises(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <Link
        href="/prospection"
        className="text-sm text-grey-brand underline underline-offset-2 hover:text-navy-700"
      >
        ← Retour à la prospection
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="font-display text-2xl font-bold text-navy-800">
          Nouveau prospect
        </h1>
        <p className="mt-1 text-sm text-grey-brand">
          {estAdmin
            ? "Saisie unitaire. L'import d'un fichier complet arrive à l'étape 4."
            : "Le prospect te sera attribué automatiquement."}
        </p>
      </header>

      <FicheForm
        estAdmin={estAdmin}
        sources={sources
          .filter((s) => s.is_active)
          .map((s) => ({ value: s.id, label: s.name }))}
        champsPerso={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))}
        commerciaux={(profils ?? []).map((c) => ({
          value: c.id,
          label: c.full_name,
        }))}
      />
    </main>
  );
}
