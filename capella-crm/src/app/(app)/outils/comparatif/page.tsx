import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ComparatifPage({ searchParams }: { searchParams: Promise<{ prospect?: string }> }) {
  await requireProfile();
  const { prospect: prospectId } = await searchParams;
  if (!prospectId) notFound();

  const supabase = await createClient();
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, raison_sociale, nom, prenom, pdl, pce, car_electricite, car_gaz, option_tarifaire")
    .eq("id", prospectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!prospect) notFound();

  const params = new URLSearchParams({
    prospect: prospect.id,
    company: prospect.raison_sociale ?? "",
    firstName: prospect.prenom ?? "",
    lastName: prospect.nom ?? "",
    pdl: prospect.pdl ?? prospect.pce ?? "",
    energy: prospect.pce && !prospect.pdl ? "gas" : "electricity",
    car: String(prospect.pce && !prospect.pdl ? (prospect.car_gaz ?? "") : (prospect.car_electricite ?? "")),
    option: prospect.option_tarifaire ?? "",
  });

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/prospection/${prospect.id}`} className="text-sm text-grey-brand underline underline-offset-2 hover:text-navy-700">← Retour à la fiche</Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-navy-800">Générateur de comparatif</h1>
          <p className="text-sm text-grey-brand">TABGen prérempli avec les données disponibles dans le CRM. Le PDF généré est automatiquement sauvegardé dans la fiche client.</p>
        </div>
      </div>
      <iframe
        title="TABGen — Générateur de comparatifs"
        src={`/outils/comparatif/embed?${params.toString()}`}
        className="h-[calc(100vh-150px)] min-h-[760px] w-full rounded-xl border border-navy-100 bg-white"
      />
    </main>
  );
}
