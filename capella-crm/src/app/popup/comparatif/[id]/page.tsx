import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ComparatifPopupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, raison_sociale, nom, prenom, pdl, pce, car_electricite, car_gaz, option_tarifaire")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!prospect) notFound();

  const query = new URLSearchParams({
    prospect: prospect.id,
    company: prospect.raison_sociale ?? "",
    firstName: prospect.prenom ?? "",
    lastName: prospect.nom ?? "",
    pdl: prospect.pdl ?? prospect.pce ?? "",
    energy: prospect.pce && !prospect.pdl ? "gas" : "electricity",
    car: String(prospect.pce && !prospect.pdl ? (prospect.car_gaz ?? "") : (prospect.car_electricite ?? "")),
    option: prospect.option_tarifaire ?? "",
  });

  return <main className="h-screen w-full bg-white p-2">
    <iframe title="TABGen — Générateur de comparatifs" src={`/outils/comparatif/embed?${query.toString()}`} className="h-full w-full rounded-xl border border-navy-100 bg-white" />
  </main>;
}
