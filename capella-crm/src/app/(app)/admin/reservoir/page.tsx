import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./import-form";
import {
  AttributionParPuissance,
  NouveauChampPerso,
  NouvelleSource,
  TableauReservoir,
  type LeadReservoir,
} from "./attribution";
import { filtrePuissance, puissancesDe } from "./puissances";
import { chargerSources, chargerChampsPersonnalises } from "@/lib/referentiels";

export const metadata = { title: "Réservoir — Capella CRM" };
export const dynamic = "force-dynamic";

const PAR_PAGE = 100;
async function chargerPuissances(supabase: Awaited<ReturnType<typeof createClient>>) {
  const counts = new Map<number, number>();
  let inconnues = 0;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await (supabase as any).from("reservoir_disponible").select("puissance,id")
      .is("assigned_to", null).is("deleted_at", null).order("id").range(offset, offset + 999);
    if (error) throw new Error(`Impossible de compter les puissances : ${error.message}`);
    for (const p of data ?? []) {
      if (!p.puissance?.trim()) inconnues++;
      for (const n of puissancesDe(p.puissance)) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    if (!data || data.length < 1000) break;
  }
  return { valeurs: [...counts.entries()].sort((a, b) => a[0] - b[0]), inconnues };
}

export default async function ReservoirPage({
  searchParams,
}: {
  searchParams: Promise<{ kva?: string; page?: string }>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const params = await searchParams;
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, 1000000)) : 1;
  const { valeurs: puissances, inconnues } = await chargerPuissances(supabase);
  const kva =
    params.kva === "inconnue"
      ? "inconnue"
      : puissances.some(([n]) => n === Number(params.kva))
        ? (params.kva ?? "")
        : "";

  let requeteLeads = (supabase as any)
    .from("reservoir_disponible")
    .select("id,ref,raison_sociale,nom,prenom,tel_mobile,siren,source_id,created_at,puissance", { count: "exact" })
    .is("assigned_to", null)
    .is("deleted_at", null);

  if (kva === "inconnue") {
    requeteLeads = requeteLeads.or("puissance.is.null,puissance.eq.");
  } else if (kva) {
    requeteLeads = requeteLeads.or(filtrePuissance(kva));
  }

  const [
    { data: leadsBruts, count: totalReservoir, error: leadsError },
    sources,
    { data: profils },
    champsPerso,
  ] = await Promise.all([
    requeteLeads
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1),
    chargerSources(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name"),
    chargerChampsPersonnalises(),
  ]);

  const listeSources = sources;
  const nomParSource = new Map(listeSources.map((s) => [s.id, s.name]));

  if (leadsError) throw new Error(`Impossible de charger le réservoir : ${leadsError.message}`);
  const leads: LeadReservoir[] = (leadsBruts ?? []).map(l => ({
    ...l, source: l.source_id ? (nomParSource.get(l.source_id) ?? null) : null,
  }));
  const totalPages = Math.max(1, Math.ceil((totalReservoir ?? 0) / PAR_PAGE));
  function lienPage(numero: number) {
    const query = new URLSearchParams();
    if (kva) query.set("kva", kva);
    query.set("page", String(numero));
    return `/admin/reservoir?${query}`;
  }

  const commerciaux = (profils ?? []).map((p) => ({
    value: p.id,
    label: p.full_name,
  }));

  if (page > totalPages) redirect(lienPage(totalPages));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-navy-800">
          Réservoir &amp; attribution
        </h1>

      </header>

      <div className="space-y-6">
        <div id="liste-reservoir">
        <TableauReservoir
          key={`${kva}:${page}:${leads.map(l => l.id).join(",")}`}
          leads={leads}
          commerciaux={commerciaux}
          total={totalReservoir ?? 0}
          kva={kva}
          puissancesKva={puissances}
          inconnues={inconnues}
        />

        </div>

        <nav aria-label="Pages du réservoir" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-grey-brand">{leads.length} leads affichés sur {totalReservoir ?? 0} · Page {page} sur {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={lienPage(Math.min(page - 1, totalPages))} className="rounded-lg border border-navy-200 px-3 py-2">Précédent</Link> : null}
            {page < totalPages ? <Link href={lienPage(page + 1)} className="rounded-lg border border-navy-200 px-3 py-2">Suivant</Link> : null}
          </div>
        </nav>



        <AttributionParPuissance
          puissances={[...puissances.map(([n, total]) => ({ value: String(n), label: `${n} kVA`, disponibles: total })), { value: "inconnue", label: "Puissance non renseignée", disponibles: inconnues }]}
          commerciaux={commerciaux}
        />

        <ImportForm
          sources={listeSources
            .filter((s) => s.is_active)
            .map((s) => ({ value: s.id, label: s.name }))}
          commerciaux={commerciaux}
          champsPerso={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))}
        />

        <NouvelleSource />

        <NouveauChampPerso
          champs={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))}
        />


      </div>
    </main>
  );
}
