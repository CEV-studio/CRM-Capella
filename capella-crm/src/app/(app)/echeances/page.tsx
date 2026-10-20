import Link from "next/link";
import { ArrowDownRight, ArrowRight, CalendarClock, Search } from "lucide-react";
import { requireProfile, voitTout } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Échéances — Capella CRM" };
export const dynamic = "force-dynamic";

type ProspectRow = {
  id: string;
  ref: string | null;
  raison_sociale: string | null;
  nom: string | null;
  prenom: string | null;
  mail: string | null;
  tel_mobile: string | null;
  tel_fixe: string | null;
  stage: string;
  date_fin_contrat: string | null;
  fournisseur_electricite: string | null;
  fournisseur_gaz: string | null;
  segment: string | null;
  assigned_to: string | null;
};
type MeterRow = {
  id: string;
  prospect_id: string;
  type_energie: "electricite" | "gaz";
  numero: string;
  segment: string | null;
  date_echeance: string;
};
type Deadline = {
  key: string;
  prospect: ProspectRow;
  date: string;
  kind: string;
  identifier: string | null;
  supplier: string | null;
};
type Period = "toutes" | "retard" | "0_12" | "12_18" | "18_plus";
type SearchParams = Promise<{ q?: string; periode?: string; page?: string }>;
type QueryBuilder = {
  select(columns: string): QueryBuilder;
  is(column: string, value: unknown): QueryBuilder;
  not(column: string, operator: string, value: unknown): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, values: string[]): QueryBuilder;
  range(from: number, to: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
};
type DynamicClient = { from(table: string): QueryBuilder };

const PAGE_SIZE = 50;
const selectProspect = "id,ref,raison_sociale,nom,prenom,mail,tel_mobile,tel_fixe,stage,date_fin_contrat,fournisseur_electricite,fournisseur_gaz,segment,assigned_to";

function fetchAll<T>(query: () => QueryBuilder): Promise<T[]> {
  return (async () => {
    const rows: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await query().range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) return rows;
    }
  })();
}

function companyName(prospect: ProspectRow) {
  return prospect.raison_sociale || [prospect.prenom, prospect.nom].filter(Boolean).join(" ") || "Dossier sans nom";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "long", year: "numeric" })
    .format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function parisToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const monthIndex = year * 12 + month - 1 + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function daysUntil(today: string, date: string) {
  return Math.round((new Date(`${date.slice(0, 10)}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
}

function periodFor(date: string, today: string, oneYear: string, eighteenMonths: string): Exclude<Period, "toutes"> {
  if (date < today) return "retard";
  if (date <= oneYear) return "0_12";
  if (date <= eighteenMonths) return "12_18";
  return "18_plus";
}

function periodLabel(date: string, today: string, eighteenMonths: string) {
  if (date < today) return "Échéance dépassée";
  if (date <= eighteenMonths) return "À anticiper · alerte 18 mois";
  return "À venir · hors alerte";
}

function hrefFor(period: Period, q: string, page = 1) {
  const params = new URLSearchParams();
  if (period !== "toutes") params.set("periode", period);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/echeances${query ? `?${query}` : ""}`;
}

export default async function EcheancesPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const db = supabase as unknown as DynamicClient;
  const params = await searchParams;
  const period: Period = ["toutes", "retard", "0_12", "12_18", "18_plus"].includes(params.periode ?? "") ? (params.periode as Period) : "toutes";
  const q = (params.q ?? "").trim().slice(0, 120);
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const allVisible = voitTout(profile);
  const today = parisToday();
  const oneYear = addMonths(today, 12);
  const eighteenMonths = addMonths(today, 18);

  const scopedProspects = () => {
    let query = db.from("prospects").select(selectProspect).is("deleted_at", null);
    if (!allVisible) query = query.eq("assigned_to", profile.id);
    return query;
  };
  const [contracts, meterRows] = await Promise.all([
    fetchAll<ProspectRow>(() => scopedProspects().not("date_fin_contrat", "is", null)),
    fetchAll<MeterRow>(() => db.from("prospect_compteurs").select("id,prospect_id,type_energie,numero,segment,date_echeance").is("archived_at", null).not("date_echeance", "is", null)),
  ]).catch((error) => {
    throw new Error(`Impossible de charger les échéances : ${error instanceof Error ? error.message : "erreur inconnue"}`);
  });

  const visibleMeterProspectIds = [...new Set(meterRows.map((meter) => meter.prospect_id))];
  const meterProspects: ProspectRow[] = [];
  for (let offset = 0; offset < visibleMeterProspectIds.length; offset += 200) {
    const ids = visibleMeterProspectIds.slice(offset, offset + 200);
    meterProspects.push(...await fetchAll<ProspectRow>(() => scopedProspects().in("id", ids)));
  }
  const prospectsById = new Map([...contracts, ...meterProspects].map((prospect) => [prospect.id, prospect]));
  const validMeters = meterRows.filter((meter) => prospectsById.has(meter.prospect_id));
  const prospectsWithMeterDeadline = new Set(validMeters.map((meter) => meter.prospect_id));

  const deadlines: Deadline[] = validMeters.map((meter) => {
    const prospect = prospectsById.get(meter.prospect_id)!;
    const isGas = meter.type_energie === "gaz";
    return {
      key: `meter-${meter.id}`,
      prospect,
      date: meter.date_echeance,
      kind: isGas ? "Gaz" : `Électricité${meter.segment ? ` · ${meter.segment}` : ""}`,
      identifier: `${isGas ? "PCE" : "PDL"} ${meter.numero}`,
      supplier: isGas ? prospect.fournisseur_gaz : prospect.fournisseur_electricite,
    };
  });
  for (const prospect of contracts) {
    if (!prospect.date_fin_contrat || prospectsWithMeterDeadline.has(prospect.id)) continue;
    deadlines.push({
      key: `contract-${prospect.id}`,
      prospect,
      date: prospect.date_fin_contrat,
      kind: "Contrat",
      identifier: null,
      supplier: [prospect.fournisseur_electricite, prospect.fournisseur_gaz].filter(Boolean).join(" / ") || null,
    });
  }

  const searchable = deadlines.filter((item) => {
    if (!q) return true;
    const haystack = [companyName(item.prospect), item.prospect.prenom, item.prospect.nom, item.prospect.mail, item.prospect.tel_mobile, item.prospect.tel_fixe, item.prospect.stage, item.identifier, item.supplier].filter(Boolean).join(" ").toLocaleLowerCase("fr-FR");
    return haystack.includes(q.toLocaleLowerCase("fr-FR"));
  });
  const matching = searchable.filter((item) => period === "toutes" || periodFor(item.date, today, oneYear, eighteenMonths) === period)
    .sort((a, b) => a.date.localeCompare(b.date) || companyName(a.prospect).localeCompare(companyName(b.prospect), "fr"));
  const counts = {
    toutes: searchable.length,
    retard: searchable.filter((item) => item.date < today).length,
    alerte: searchable.filter((item) => item.date >= today && item.date <= eighteenMonths).length,
    zeroDouze: searchable.filter((item) => item.date >= today && item.date <= oneYear).length,
    douzeDixHuit: searchable.filter((item) => item.date > oneYear && item.date <= eighteenMonths).length,
    plusTard: searchable.filter((item) => item.date > eighteenMonths).length,
  };
  const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = matching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filters: Array<{ value: Period; label: string; count: number }> = [
    { value: "toutes", label: "Toutes les échéances", count: counts.toutes },
    { value: "retard", label: "Dépassées", count: counts.retard },
    { value: "0_12", label: "Dans les 12 mois", count: counts.zeroDouze },
    { value: "12_18", label: "Dans 12 à 18 mois", count: counts.douzeDixHuit },
    { value: "18_plus", label: "Au-delà de 18 mois", count: counts.plusTard },
  ];

  return (
    <main className="mx-auto w-full max-w-[1580px] px-4 py-6 lg:px-7 lg:py-8">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800"><CalendarClock size={14}/>Suivi des contrats</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-navy-900">Échéances</h1>
          <p className="mt-1 max-w-3xl text-sm text-navy-500">Tous les dossiers avec une date connue. L’alerte commence 18 mois avant l’échéance et reste visible après son dépassement.</p>
        </div>
        <form action="/echeances" className="flex w-full gap-2 md:max-w-md">
          {period !== "toutes" ? <input type="hidden" name="periode" value={period}/> : null}
          <label className="relative min-w-0 flex-1"><span className="sr-only">Rechercher un dossier, un compteur ou un fournisseur</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"/><input name="q" defaultValue={q} placeholder="Entreprise, PDL/PCE, contact…" className="h-11 w-full rounded-xl border border-navy-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-capella-500"/></label>
          <button className="h-11 rounded-xl bg-navy-900 px-4 text-sm font-bold text-white hover:bg-navy-700">Rechercher</button>
        </form>
      </header>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm"><span className="text-xs font-bold uppercase tracking-wide text-navy-500">Échéances suivies</span><div className="mt-2 font-display text-3xl font-black text-navy-900">{counts.toutes}</div></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm"><span className="text-xs font-bold uppercase tracking-wide text-amber-800">À anticiper · 18 mois</span><div className="mt-2 font-display text-3xl font-black text-navy-900">{counts.alerte}</div><p className="mt-1 text-xs text-navy-500">dont {counts.douzeDixHuit} entre 12 et 18 mois</p></div>
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 shadow-sm"><span className="text-xs font-bold uppercase tracking-wide text-red-700">Échéances dépassées</span><div className="mt-2 font-display text-3xl font-black text-navy-900">{counts.retard}</div></div>
        <div className="rounded-2xl border border-sky-capella-200 bg-sky-capella-50/50 p-4 shadow-sm"><span className="text-xs font-bold uppercase tracking-wide text-sky-capella-700">Au-delà de 18 mois</span><div className="mt-2 font-display text-3xl font-black text-navy-900">{counts.plusTard}</div></div>
      </section>

      <nav aria-label="Filtrer les échéances" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => <Link key={filter.value} href={hrefFor(filter.value, q)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${period === filter.value ? "border-navy-900 bg-navy-900 text-white" : "border-navy-200 bg-white text-navy-700 hover:bg-navy-50"}`}><span>{filter.label}</span><span className={`rounded-full px-1.5 py-0.5 tabular ${period === filter.value ? "bg-white/15" : "bg-navy-50"}`}>{filter.count}</span></Link>)}
      </nav>

      <section className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 px-4 py-3">
          <div><h2 className="font-display text-base font-bold text-navy-900">Dossiers à suivre</h2><p className="text-xs text-navy-500">Triés par date d’échéance, de la plus proche à la plus lointaine.</p></div>
          <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-bold text-navy-700">{matching.length} résultat{matching.length > 1 ? "s" : ""}</span>
        </div>
        {pageRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[950px] border-collapse text-left text-sm">
          <thead><tr className="bg-navy-50/70 text-[10px] font-bold uppercase tracking-wide text-navy-500"><th className="px-4 py-3">Échéance</th><th className="px-4 py-3">Entreprise / dossier</th><th className="px-4 py-3">Compteur</th><th className="px-4 py-3">Fournisseur</th><th className="px-4 py-3">Étape</th><th className="px-4 py-3"><span className="sr-only">Ouvrir</span></th></tr></thead>
          <tbody className="divide-y divide-navy-100">
            {pageRows.map((item) => {
              const days = daysUntil(today, item.date);
              const label = periodLabel(item.date, today, eighteenMonths);
              return <tr key={item.key} className="transition hover:bg-sky-capella-50/30">
                <td className="whitespace-nowrap px-4 py-3"><div className="font-bold tabular text-navy-900">{formatDate(item.date)}</div><div className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${days < 0 ? "text-red-700" : days <= 548 ? "text-amber-800" : "text-sky-capella-700"}`}>{days < 0 ? <ArrowDownRight size={12}/> : null}{days < 0 ? `${Math.abs(days)} j de retard` : days === 0 ? "Aujourd’hui" : `dans ${days} jours`}</div></td>
                <td className="px-4 py-3"><Link href={`/prospection/${item.prospect.id}`} className="font-bold text-navy-900 hover:text-sky-capella-700">{companyName(item.prospect)}</Link><div className="mt-1 text-xs text-navy-500">{[item.prospect.prenom, item.prospect.nom].filter(Boolean).join(" ") || item.prospect.ref || "Contact non renseigné"}</div><div className={`mt-1 text-[10px] font-semibold ${days < 0 ? "text-red-700" : days <= 548 ? "text-amber-800" : "text-navy-400"}`}>{label}</div></td>
                <td className="px-4 py-3"><div className="font-medium text-navy-800">{item.kind}</div><div className="mt-1 text-xs tabular text-navy-500">{item.identifier ?? "Échéance générale du dossier"}</div></td>
                <td className="px-4 py-3 text-xs text-navy-700">{item.supplier || "—"}</td>
                <td className="px-4 py-3"><span className="inline-flex rounded-full bg-navy-50 px-2.5 py-1 text-[10px] font-bold text-navy-700">{item.prospect.stage}</span></td>
                <td className="px-4 py-3 text-right"><Link href={`/prospection/${item.prospect.id}`} aria-label={`Ouvrir ${companyName(item.prospect)}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-navy-200 text-navy-600 hover:bg-sky-capella-50"><ArrowRight size={15}/></Link></td>
              </tr>;
            })}
          </tbody>
        </table></div> : <div className="px-5 py-12 text-center"><CalendarClock size={24} className="mx-auto text-navy-300"/><p className="mt-3 text-sm font-semibold text-navy-700">Aucun dossier dans cette vue.</p><p className="mt-1 text-xs text-navy-500">Essaie une autre période ou enlève ta recherche.</p></div>}
        {totalPages > 1 ? <footer className="flex items-center justify-between border-t border-navy-100 px-4 py-3 text-sm"><span className="text-xs tabular text-navy-500">Page {currentPage} sur {totalPages}</span><div className="flex gap-2">{currentPage > 1 ? <Link href={hrefFor(period, q, currentPage - 1)} className="rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50">Précédent</Link> : null}{currentPage < totalPages ? <Link href={hrefFor(period, q, currentPage + 1)} className="rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50">Suivant</Link> : null}</div></footer> : null}
      </section>
      <p className="mt-4 text-xs text-navy-500">La période d’anticipation démarre à J−18 mois. Les dates déjà passées restent affichées pour faciliter le rattrapage.</p>
    </main>
  );
}
