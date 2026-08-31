import Link from "next/link";
import { AlarmClock, ArrowRight, CalendarDays, CircleAlert, Clock3, Flame, RotateCcw, Target, Zap } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { evaluateDiscipline, formatParisDateTime, type DisciplineEvent } from "@/lib/domain/discipline";
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
  bucket: "maintenant" | "travail" | "reactiver";
  reason: string;
  detail: string | null;
  urgent: boolean;
  anomaly: boolean;
  renewalDate?: string | null;
};

type RenewalRow = {
  id: string;
  prospect_id: string;
  date_echeance: string;
  prospect: Row | Row[] | null;
};

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

function datePlusDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function daysUntil(date: string, today: string) {
  const [ty, tm, td] = today.split("-").map(Number);
  const [dy, dm, dd] = date.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
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
            <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-bold text-navy-600">{item.renewalDate ? "Renouvellement" : p.stage}</span>
            {item.anomaly ? <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700"><CircleAlert size={11}/>À corriger</span> : null}
          </div>
          <div className={`mt-2 text-sm font-bold ${item.urgent ? "text-star-700" : "text-navy-800"}`}>{item.reason}</div>
          {item.detail ? <div className="mt-1 text-xs leading-5 text-navy-500">{item.detail}</div> : null}
          {item.event ? <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sky-capella-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-capella-700">{item.event.kind === "rdv" ? <CalendarDays size={13}/> : <AlarmClock size={13}/>} {formatParisDateTime(item.event.start_at)}</div> : null}
          {item.renewalDate ? <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-star-50 px-2.5 py-1.5 text-[11px] font-semibold text-star-700"><RotateCcw size={13}/>Échéance contrat · {formatDate(item.renewalDate)}</div> : null}
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
  const renewalHorizon = datePlusDays(now, 180);
  const prospectColumns = "id, ref, raison_sociale, nom, prenom, mail, tel_mobile, tel_fixe, stage, stage_entered_at, next_action, next_action_date, last_action_at, date_fin_contrat, became_client_at, created_at, updated_at, segment, car_electricite, car_gaz, fournisseur_electricite, fournisseur_gaz, assigned_to";

  let prospectsQuery = (supabase as any)
    .from("prospects")
    .select(prospectColumns)
    .is("deleted_at", null)
    .is("entered_conversion_at", null);
  let eventsQuery = (supabase as any)
    .from("calendar_events")
    .select("prospect_id, kind, title, start_at, end_at")
    .eq("status", "confirmed")
    .gte("start_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
    .lt("start_at", new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("start_at", { ascending: true });
  let renewalQuery = (supabase as any)
    .from("affaires")
    .select(`id, prospect_id, date_echeance, prospect:prospects!inner(${prospectColumns})`)
    .eq("stage", "Signé")
    .is("deleted_at", null)
    .not("prospect_id", "is", null)
    .not("date_echeance", "is", null)
    .lte("date_echeance", renewalHorizon)
    .order("date_echeance", { ascending: true });

  if (profile.role !== "admin") {
    prospectsQuery = prospectsQuery.eq("assigned_to", profile.id);
    eventsQuery = eventsQuery.eq("profile_id", profile.id);
    renewalQuery = renewalQuery.eq("commercial_id", profile.id);
  }

  const [{ data: prospectData, error }, { data: eventData }, { data: renewalData }] = await Promise.all([prospectsQuery, eventsQuery, renewalQuery]);
  const prospects = (prospectData ?? []) as Row[];
  const events = (eventData ?? []) as DisciplineEvent[];
  const nextByProspect = new Map<string, DisciplineEvent>();
  for (const event of events) {
    if (!nextByProspect.has(event.prospect_id)) nextByProspect.set(event.prospect_id, event);
  }

  const activeItems = prospects
    .map((prospect): WorkItem | null => {
      const event = nextByProspect.get(prospect.id) ?? null;
      const result = evaluateDiscipline(prospect, event, now);
      if (result.bucket === "ignore") return null;
      return {
        key: `prospect-${prospect.id}`,
        prospect,
        event,
        priority: result.priority,
        bucket: result.bucket,
        reason: result.reason,
        detail: result.detail,
        urgent: result.urgent,
        anomaly: result.anomaly,
      };
    })
    .filter((item): item is WorkItem => Boolean(item));

  const today = dateKeyParis(now);
  const renewalItems = ((renewalData ?? []) as RenewalRow[])
    .map((row): WorkItem | null => {
      const prospect = Array.isArray(row.prospect) ? row.prospect[0] : row.prospect;
      if (!prospect || !row.date_echeance) return null;
      const remaining = daysUntil(row.date_echeance, today);
      const overdue = remaining < 0;
      return {
        key: `renewal-${row.id}`,
        prospect,
        event: null,
        priority: overdue ? 121 : remaining <= 30 ? 108 : remaining <= 60 ? 100 : 92,
        bucket: overdue ? "maintenant" : "reactiver",
        reason: overdue ? "Contrat arrivé à échéance" : remaining === 0 ? "Contrat à renouveler aujourd’hui" : `Renouvellement dans ${remaining} jours`,
        detail: overdue ? "Client signé à reconquérir immédiatement." : "Ancien client signé : reprendre contact avant l’échéance pour sécuriser le renouvellement.",
        urgent: overdue || remaining <= 60,
        anomaly: overdue,
        renewalDate: row.date_echeance,
      };
    })
    .filter((item): item is WorkItem => Boolean(item));

  const items = [...activeItems, ...renewalItems]
    .sort((a, b) => b.priority - a.priority || label(a.prospect).localeCompare(label(b.prospect), "fr"));
  const maintenant = items.filter((x) => x.bucket === "maintenant");
  const travail = items.filter((x) => x.bucket === "travail");
  const reactiver = items.filter((x) => x.bucket === "reactiver");
  const anomalies = items.filter((x) => x.anomaly);
  const top = maintenant[0] ?? travail[0] ?? reactiver[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-[1580px] px-4 py-6 lg:px-7 lg:py-8">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-star-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-star-700"><Target size={13}/>Cockpit commercial</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-navy-900">Ma journée</h1>
          <p className="mt-1 max-w-3xl text-sm text-navy-500">Le CRM analyse les prospects actifs, les rappels, les RDV comparatifs, le temps passé dans chaque étape, les DDF futures et les anciens contrats signés à renouveler. La cible : zéro opportunité oubliée.</p>
        </div>
        {top ? <Link href={`/prospection/${top.prospect.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-star-500 px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(232,96,48,.20)] hover:bg-star-600"><Flame size={17}/>Traiter le prospect prioritaire<ArrowRight size={16}/></Link> : null}
      </header>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Lecture impossible : {error.message}</div> : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-star-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-star-700">À faire maintenant</span><Flame size={17} className="text-star-500"/></div><div className="mt-2 font-display text-3xl font-black text-navy-900">{maintenant.length}</div><div className="mt-1 text-xs text-grey-brand">Retards, RDV, relances et renouvellements urgents</div></div>
        <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-navy-500">À travailler</span><Target size={17} className="text-sky-capella-600"/></div><div className="mt-2 font-display text-3xl font-black text-navy-900">{travail.length}</div><div className="mt-1 text-xs text-grey-brand">Prospection active classée par priorité</div></div>
        <div className="rounded-2xl border border-sky-capella-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-sky-capella-700">À réactiver</span><RotateCcw size={17} className="text-sky-capella-600"/></div><div className="mt-2 font-display text-3xl font-black text-navy-900">{reactiver.length}</div><div className="mt-1 text-xs text-grey-brand">DDF et contrats signés à moins de 6 mois</div></div>
        <div className={`rounded-2xl border bg-white p-4 shadow-sm ${anomalies.length ? "border-red-200" : "border-green-200"}`}><div className="flex items-center justify-between"><span className={`text-xs font-bold uppercase tracking-wide ${anomalies.length ? "text-red-700" : "text-green-700"}`}>Anomalies</span><CircleAlert size={17} className={anomalies.length ? "text-red-500" : "text-green-500"}/></div><div className="mt-2 font-display text-3xl font-black text-navy-900">{anomalies.length}</div><div className="mt-1 text-xs text-grey-brand">Dossiers qui peuvent être oubliés · cible 0</div></div>
      </section>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,.6fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-navy-900">À faire maintenant</h2><p className="text-xs text-grey-brand">Le commercial traite cette file de haut en bas.</p></div><span className="rounded-full bg-star-100 px-2.5 py-1 text-xs font-bold text-star-700">{maintenant.length}</span></div>
          {maintenant.length ? <div className="space-y-3">{maintenant.slice(0, 40).map((item, i) => <WorkCard key={item.key} item={item} rank={i + 1}/>)}</div> : <div className="rounded-2xl border border-dashed border-green-200 bg-green-50/50 p-10 text-center"><div className="font-display text-lg font-bold text-green-800">File critique vide</div><p className="mt-1 text-sm text-green-700">Aucun retard, oubli ou renouvellement urgent détecté.</p></div>}
        </section>

        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-navy-900">À réactiver</h2><p className="text-xs text-grey-brand">Les affaires futures reviennent automatiquement dans le radar.</p></div><RotateCcw size={17} className="text-sky-capella-600"/></div>
            {reactiver.length ? <div className="space-y-3">{reactiver.slice(0, 12).map((item) => <WorkCard key={item.key} item={item}/>)}</div> : <div className="rounded-2xl border border-dashed border-navy-200 bg-white p-6 text-center text-sm text-grey-brand">Aucune DDF ou échéance de contrat à réactiver dans les 6 prochains mois.</div>}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-navy-900">À travailler ensuite</h2><p className="text-xs text-grey-brand">Le moteur classe la prospection active par ancienneté et risque d’oubli.</p></div><Clock3 size={17} className="text-navy-400"/></div>
            {travail.length ? <div className="space-y-3">{travail.slice(0, 12).map((item) => <WorkCard key={item.key} item={item}/>)}</div> : <div className="rounded-2xl border border-dashed border-navy-200 bg-white p-6 text-center text-sm text-grey-brand">Aucun dossier supplémentaire à travailler.</div>}
          </section>
        </div>
      </div>
    </main>
  );
}
