import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./import-form";
import {
  AttributionParSource,
  NouveauChampPerso,
  NouvelleSource,
  Reattribution,
  TableauReservoir,
  type LeadReservoir,
} from "./attribution";
import { chargerSources, chargerChampsPersonnalises } from "@/lib/referentiels";

export const metadata = { title: "Réservoir — Capella CRM" };
export const dynamic = "force-dynamic";

const PAR_PAGE = 100;
const PUISSANCES_KVA = [3, 6, 9, 12, 15, 18, 24, 30, 36, 42, 48, 60, 72, 90, 120];

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
  const kva =
    params.kva === "inconnue"
      ? "inconnue"
      : PUISSANCES_KVA.includes(Number(params.kva))
        ? (params.kva ?? "")
        : "";

  let requeteLeads = supabase
    .from("prospects")
    .select("id,ref,raison_sociale,nom,prenom,tel_mobile,siren,source_id,created_at", { count: "exact" })
    .is("assigned_to", null)
    .is("deleted_at", null);

  if (kva === "inconnue") {
    requeteLeads = requeteLeads.or("puissance.is.null,puissance.eq.");
  } else if (kva) {
    // Un prospect peut avoir plusieurs compteurs, stockés sous la forme
    // « 36 kVA · 18 kVA ». On teste chaque position pour éviter que 6 kVA
    // ne récupère aussi les fiches en 36 kVA.
    const motifs = [
      `puissance.eq.${kva}`,
      `puissance.ilike.${kva} kVA`,
      `puissance.ilike.${kva} kVA · %`,
      `puissance.ilike.% · ${kva} kVA · %`,
      `puissance.ilike.% · ${kva} kVA`,
      `puissance.ilike.${kva}kVA`,
      `puissance.ilike.${kva}kVA · %`,
      `puissance.ilike.% · ${kva}kVA · %`,
      `puissance.ilike.% · ${kva}kVA`,
    ];
    requeteLeads = requeteLeads.or(motifs.join(","));
  }

  const [
    { data: leadsBruts, count: totalReservoir, error: leadsError },
    sources,
    { data: profils },
    { data: parSource, error: countsError },
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
    // Sert uniquement à compter les leads disponibles par source.
    supabase.rpc("crm_reservoir_counts"),
    chargerChampsPersonnalises(),
  ]);

  const listeSources = sources;
  const nomParSource = new Map(listeSources.map((s) => [s.id, s.name]));

  if (leadsError || countsError) throw new Error(`Impossible de charger le réservoir : ${leadsError?.message ?? countsError?.message}`);
  const disponiblesParSource = new Map((parSource ?? []).map(p => [p.source_id, p.total]));
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
  const sansSource = disponiblesParSource.get(null) ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-navy-800">
          Réservoir &amp; attribution
        </h1>

      </header>

      <div className="space-y-6">
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

        <AttributionParSource
          sources={listeSources
            .filter((s) => s.is_active)
            .map((s) => ({
              value: s.id,
              label: s.name,
              disponibles: disponiblesParSource.get(s.id) ?? 0,
            }))}
          commerciaux={commerciaux}
        />

        <TableauReservoir
          key={`${kva}:${page}:${leads.map(l => l.id).join(",")}`}
          leads={leads}
          commerciaux={commerciaux}
          total={totalReservoir ?? 0}
          kva={kva}
          puissancesKva={PUISSANCES_KVA}
        />

        <nav aria-label="Pages du réservoir" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-grey-brand">{leads.length} leads affichés sur {totalReservoir ?? 0} · Page {page} sur {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={lienPage(Math.min(page - 1, totalPages))} className="rounded-lg border border-navy-200 px-3 py-2">Précédent</Link> : null}
            {page < totalPages ? <Link href={lienPage(page + 1)} className="rounded-lg border border-navy-200 px-3 py-2">Suivant</Link> : null}
          </div>
        </nav>



        <Reattribution commerciaux={commerciaux} />
      </div>
    </main>
  );
}
