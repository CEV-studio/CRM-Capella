import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FicheForm } from "../../fiche-form";
import { chargerSources, chargerChampsPersonnalises } from "@/lib/referentiels";
import type { Prospect, Profile } from "@/lib/domain/database.types";

export const dynamic = "force-dynamic";

export default async function ModifierProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const supabase = await createClient();

  const { data: prospect } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!prospect) notFound();

  const [sources, { data: profils }, champsPerso] = await Promise.all([
    chargerSources(),
    estAdmin
      ? supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[] }),
    chargerChampsPersonnalises(),
  ]);

  const p = prospect as Prospect;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6">
        <Link href={`/prospection/${p.id}`} className="text-sm text-grey-brand underline underline-offset-2 hover:text-navy-700">← Retour à la fiche client</Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-navy-800">Modifier les informations</h1>
        <p className="mt-1 text-sm text-grey-brand">Tous les champs de la fiche sont regroupés ici pour garder l’écran commercial principal léger.</p>
      </div>

      <FicheForm
        prospect={p}
        estAdmin={estAdmin}
        sources={sources.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))}
        champsPerso={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))}
        commerciaux={(profils ?? []).map((c) => ({ value: c.id, label: c.full_name }))}
      />
    </main>
  );
}
