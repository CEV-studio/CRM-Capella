import Link from "next/link";
import { AlarmClock, ArrowRight, CalendarDays, CircleAlert, Flame, Target, Zap } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatParisDateTime, type DisciplineEvent } from "@/lib/domain/discipline";
import type { Prospect } from "@/lib/domain/database.types";
import { ProspectFichePopup } from "@/components/prospect-fiche-popup";

export const metadata = { title: "Ma journée — Capella CRM" };
export const dynamic = "force-dynamic";

type Row = Prospect & { became_client_at?: string | null; stage_entered_at?: string | null };
type WorkItem = {
  key: string;
  prospect: Row;
  event: DisciplineEvent | null;
  priority: number;
  bucket: "comparatifs" | "retards";
  reason: string;
  detail: string | null;
  urgent: boolean;
  anomaly: boolean;
};
type ExpiryItem = { prospect: Row; date: string; meter: string | null; days: number };

function label(p: Row) {
  return p.raison_sociale || [p.prenom, p.nom].filter(Boolean).join(" ") || "Prospect sans nom";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function energySummary(p: Row) {
  const bits: string[] = [];
  if (p.segment) bits.push(p.segment);
  if (p.car_electricite) bits.push(`${p.car_electricite} MWh élec`);
  if (p.car_gaz) bits.push(`${p.car_gaz} MWh gaz`);
  if (p.date_fin_contrat) bits.push(`DDF ${formatDate(p.date_fin_contrat)}`);
  return bits.join(" · ");
}

function dateKeyParis(value: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function dayDifference(from: string, to: string) {
  const a = new Date(`${from.slice(0, 10)}T12:00:00Z`).getTime();
  const b = new Date(`${to.slice(0, 10)}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function dateAfterMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const monthIndex = year * 12 + month - 1 + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function WorkCard({ item, rank }: { item: WorkItem; rank?: number }) {
  const p = item.prospect;
  const phone = p.tel_mobile || p.tel_fixe;
  return (
    <article className={`group rounded-2xl border bg-white p-4 shadow-[var(--crm-shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--crm-shadow-hover)] ${item.urgent ? "border-star-200" : "border-navy-100"}`}>
      <div className="flex items-start gap-3">
        {rank ? <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${rank === 1 ? "bg-star-500 text-white" : "bg-navy-50 text-navy-500"}`}>{rank}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ProspectFichePopup prospectId={p.id} prospectLabel={label(p)} className="truncate text-left font-display text-base font-bold text-navy-900 hover:text-sky-capella-700">{label(p)}</ProspectFichePopup>
            <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-bold text-navy-600">{p.stage}</span>
            {item.anomaly ? <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700"><CircleAlert size={11}/>À corriger</span> : null}
          </div>
          <div className={`mt-2 text-sm font-bold ${item.urgent ? "text-star-700" : "text-navy-800"}`}>{item.reason}</div>
          {item.detail ? <div className="mt-1 text-xs leading-5 text-navy-500">{item.detail}</div> : null}
          {item.event ? <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sky-capella-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-capella-700">{item.event.kind === "rdv" ? <CalendarDays size={13}/> : <AlarmClock size={13}/>} {formatParisDateTime(item.event.start_at)}</div> : null}
          {energySummary(p) ? <div className="mt-2 flex items-center gap-1.5 text-[11px] text-grey-brand"><Zap size={12} className="text-star-500"/>{energySummary(p)}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {phone ? <a href={`tel:${phone}`} className="inline-flex h-9 items-center rounded-xl bg-navy-900 px-3 text-xs font-bold text-white hover:bg-navy-700">Appeler</a> : null}
          <ProspectFichePopup prospectId={p.id} prospectLabel={label(p)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-navy-200 bg-white text-navy-700 hover:bg-sky-capella-50" ariaLabel="Ouvrir la fiche"><ArrowRight size={16}/></ProspectFichePopup>
        </div>
      </div>
    </article>
  );
}

export default async function JourneePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const now = new Date();
  const prospectColumns = "id, ref, raison_sociale, nom, prenom, mail, tel_mobile, tel_fixe, stage, stage_entered_at, next_action, next_action_date, last_action_at, date_fin_contrat, became_client_at, created_at, updated_at, segment, car_electricite, car_gaz, fournisseur_electricite, fournisseur_gaz, assigned_to, entreprise_id";

  const prospectsQuery = (supabase as any)
    .from("prospects")
    .select(prospectColumns)
    .is("deleted_at", null)
    .is("entered_conversion_at", null)
    .eq("assigned_to", profile.id);
  let reminderEventsQuery = (supabase as any)
    .from("calendar_events")
    .select("prospect_id, kind, title, start_at, end_at")
    .eq("status", "confirmed")
    .eq("kind", "rappel")
    .lt("start_at", now.toISOString())
    .order("start_at", { ascending: false });
  let comparisonEventsQuery = (supabase as any)
    .from("calendar_events")
    .select("prospect_id, kind, title, start_at, end_at")
    .eq("status", "confirmed")
    .eq("kind", "rdv")
    .gte("start_at", new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString())
    .lt("start_at", new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString())
    .order("start_at", { ascending: true });
  reminderEventsQuery = reminderEventsQuery.eq("profile_id", profile.id);
  comparisonEventsQuery = comparisonEventsQuery.eq("profile_id", profile.id);

  const [{ data: prospectData }, { data: reminderEventData, error: reminderError }, { data: comparisonEventData, error: comparisonError }] = await Promise.all([prospectsQuery, reminderEventsQuery, comparisonEventsQuery]);
  const prospects = (prospectData ?? []) as Row[];
  const prospectIds = prospects.map((prospect) => prospect.id);
  const meterChunks = Array.from({ length: Math.ceil(prospectIds.length / 200) }, (_, index) => prospectIds.slice(index * 200, (index + 1) * 200));
  const meterResults = meterChunks.length
    ? await Promise.all(meterChunks.map((ids) => (supabase as any).from("prospect_compteurs").select("prospect_id,type_energie,numero,date_echeance").in("prospect_id", ids).is("archived_at", null).not("date_echeance", "is", null)))
    : [];
  const meterData = meterResults.flatMap((result) => result.data ?? []);
  const meterError = meterResults.find((result) => result.error)?.error ?? null;
  const today = dateKeyParis(now);
  const alertHorizon = dateAfterMonths(today, 18);
  const expiryItems: ExpiryItem[] = [];
  const prospectsWithMeterExpiry = new Set<string>();
  const prospectsById = new Map(prospects.map((prospect) => [prospect.id, prospect]));
  for (const meter of (meterData ?? []) as Array<{prospect_id:string;type_energie:"electricite"|"gaz";numero:string;date_echeance:string|null}>) {
    if (!meter.date_echeance) continue;
    const days = dayDifference(today, meter.date_echeance);
    const prospect = prospectsById.get(meter.prospect_id);
    if (!prospect) continue;
    prospectsWithMeterExpiry.add(prospect.id);
    if (meter.date_echeance <= alertHorizon) expiryItems.push({ prospect, date: meter.date_echeance, meter: `${meter.type_energie === "gaz" ? "PCE" : "PDL"} ${meter.numero}`, days });
  }
  for (const prospect of prospects) {
    if (prospectsWithMeterExpiry.has(prospect.id) || !prospect.date_fin_contrat) continue;
    const days = dayDifference(today, prospect.date_fin_contrat);
    if (prospect.date_fin_contrat <= alertHorizon) expiryItems.push({ prospect, date: prospect.date_fin_contrat, meter: null, days });
  }
  expiryItems.sort((a, b) => a.days - b.days || label(a.prospect).localeCompare(label(b.prospect), "fr"));
  const prospectsIndex = new Map(prospects.map((prospect) => [prospect.id, prospect]));
  const events = ([...(reminderEventData ?? []), ...(comparisonEventData ?? [])]) as DisciplineEvent[];
  const error = reminderError ?? comparisonError;
  const eventItems = events.map((event): WorkItem | null => {
    const prospect = prospectsIndex.get(event.prospect_id);
    if (!prospect) return null;
    const overdue = new Date(event.start_at).getTime() < now.getTime();
    const comparatifAujourdhui = event.kind === "rdv" && dateKeyParis(event.start_at) === today;
    const rappelEnRetard = event.kind === "rappel" && overdue;
    if (!comparatifAujourdhui && !rappelEnRetard) return null;
    const bucket = rappelEnRetard ? "retards" : "comparatifs";
    return { key: `${bucket}-${event.prospect_id}-${event.start_at}`, prospect, event, priority: rappelEnRetard ? 3 : 2, bucket, reason: rappelEnRetard ? "Rappel en retard" : "Comparatif prévu aujourd’hui", detail: event.title, urgent: rappelEnRetard, anomaly: rappelEnRetard };
  }).filter((item): item is WorkItem => Boolean(item))
    .sort((a, b) => b.priority - a.priority || (a.event?.start_at ?? "").localeCompare(b.event?.start_at ?? "") || label(a.prospect).localeCompare(label(b.prospect), "fr"));
  const eventProspectIds=new Set(eventItems.map(item=>item.prospect.id));
  const crmItems=prospects.map((prospect):WorkItem|null=>{
    if(eventProspectIds.has(prospect.id))return null;
    const isReminder=prospect.stage==="Rappels";
    const isComparatif=prospect.stage==="RDV comparatif";
    if(!isReminder&&!isComparatif)return null;
    const overdue=Boolean(isReminder&&prospect.next_action_date&&prospect.next_action_date<today);
    const comparatifAujourdhui=Boolean(isComparatif&&prospect.next_action_date===today);
    if(!overdue&&!comparatifAujourdhui)return null;
    const bucket=overdue?"retards":"comparatifs";
    const scheduled=prospect.next_action_date?`Prévu le ${formatDate(prospect.next_action_date)}`:null;
    return {key:`crm-${bucket}-${prospect.id}`,prospect,event:null,priority:overdue?3:2,bucket,reason:overdue?"Rappel en retard":"Comparatif prévu aujourd’hui",detail:[prospect.next_action,scheduled].filter(Boolean).join(" · ")||null,urgent:overdue,anomaly:overdue};
  }).filter((item):item is WorkItem=>Boolean(item));
  const items=[...eventItems,...crmItems].sort((a,b)=>b.priority-a.priority||label(a.prospect).localeCompare(label(b.prospect),"fr"));
  const comparatifs = items.filter((x) => x.bucket === "comparatifs");
  const retards = items.filter((x) => x.bucket === "retards");
  const top = retards[0] ?? comparatifs[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-[1580px] px-4 py-6 lg:px-7 lg:py-8">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-star-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-star-700"><Target size={13}/>Cockpit commercial</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-navy-900">Ma journée</h1>
          
        </div>
        {top ? <Link href={`/prospection/${top.prospect.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-star-500 px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(232,96,48,.20)] hover:bg-star-600"><Flame size={17}/>Traiter le prospect prioritaire<ArrowRight size={16}/></Link> : null}
      </header>

      {error || meterError ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Lecture impossible : {(error ?? meterError)?.message}</div> : null}

      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-display text-lg font-bold text-navy-900">Échéances à anticiper</h2></div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{expiryItems.length} échéance{expiryItems.length > 1 ? "s" : ""}</span>
        </div>
        {expiryItems.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{expiryItems.slice(0, 30).map((item, index) => <article key={`${item.prospect.id}-${item.meter ?? "contrat"}-${item.date}-${index}`} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white p-3">
          <div className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-bold leading-tight ${item.days < 0 ? "bg-red-100 text-red-700" : item.days <= 30 ? "bg-orange-100 text-orange-800" : "bg-amber-100 text-amber-800"}`}><span className="text-base">{item.days < 0 ? Math.abs(item.days) : item.days}</span><span>{item.days < 0 ? "j retard" : "jours"}</span></div>
          <div className="min-w-0 flex-1"><ProspectFichePopup prospectId={item.prospect.id} prospectLabel={label(item.prospect)} className="block truncate text-sm font-bold text-navy-900 hover:text-sky-capella-700">{label(item.prospect)}</ProspectFichePopup><div className="mt-0.5 truncate text-xs text-navy-500">{item.meter ? `${item.meter} · ` : "Contrat · "}{formatDate(item.date)}</div></div>
          <ProspectFichePopup prospectId={item.prospect.id} prospectLabel={label(item.prospect)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-navy-200 text-navy-600 hover:bg-sky-capella-50" ariaLabel="Ouvrir le dossier"><ArrowRight size={15}/></ProspectFichePopup>
        </article>)}</div> : <div className="rounded-xl border border-dashed border-amber-200 bg-white/70 p-5 text-center text-sm text-grey-brand">Aucune échéance à anticiper dans les 18 prochains mois.</div>}
        <Link href="/echeances" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-capella-700 hover:text-sky-capella-900">Voir toutes les échéances <ArrowRight size={13}/></Link>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm"><span className="text-xs font-bold uppercase tracking-wide text-red-700">Rappels en retard</span><div className="mt-2 font-display text-3xl font-black text-navy-900">{retards.length}</div></div>
        <div className="rounded-2xl border border-sky-capella-200 bg-white p-4 shadow-sm"><span className="text-xs font-bold uppercase tracking-wide text-sky-capella-700">Comparatifs aujourd’hui</span><div className="mt-2 font-display text-3xl font-black text-navy-900">{comparatifs.length}</div></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {([["Rappels en retard", retards], ["Comparatifs aujourd’hui", comparatifs]] as const).map(([title, list]) => <section key={title}><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-bold text-navy-900">{title}</h2><span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-bold text-navy-700">{list.length}</span></div>{list.length ? <div className="space-y-3">{list.slice(0, 40).map((item, i) => <WorkCard key={item.key} item={item} rank={title === "Rappels en retard" ? i + 1 : undefined}/>)}</div> : <div className="rounded-2xl border border-dashed border-navy-200 bg-white p-6 text-center text-sm text-grey-brand">Aucun élément.</div>}</section>)}
      </div>
    </main>
  );
}
