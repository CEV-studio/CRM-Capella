import Link from "next/link";
import { AlarmClock, ArrowRight, CalendarDays, CircleAlert, Clock3, Flame, RotateCcw, Target, Zap } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { evaluateDiscipline, formatParisDateTime, type DisciplineEvent } from "@/lib/domain/discipline";
import type { Prospect } from "@/lib/domain/database.types";

export const metadata = { title: "Ma journée — Capella CRM" };
export const dynamic = "force-dynamic";

type Row = Prospect & { became_client_at?: string | null };
type WorkItem = {
  prospect: Row;
  event: DisciplineEvent | null;
  priority: number;
  bucket: "maintenant" | "travail" | "reactiver";
  reason: string;
  detail: string | null;
  urgent: boolean;
  anomaly: boolean;
};

function label(p: Row) {
  return p.raison_sociale || [p.prenom, p.nom].filter(Boolean).join(" ") || "Prospect sans nom";
}

function energySummary(p: Row) {
  const bits: string[] = [];
  if (p.segment) bits.push(p.segment);
  if (p.car_electricite) bits.push(`${p.car_electricite} MWh élec`);
  if (p.car_gaz) bits.push(`${p.car_gaz} MWh gaz`);
  if (p.date_fin_contrat) bits.push(`DDF ${new Intl.DateTimeFormat("fr-FR").format(new Date(`${p.date_fin_contrat}T12:00:00Z`))}`);
  return bits.join(" · ");
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
            <Link href={`/prospection/${p.id}`} className="truncate font-display text-base font-bold text-navy-900 hover:text-sky-capella-700">{label(p)}</Link>
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
          <Link href={`/prospection/${p.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-navy-200 bg-white text-navy-700 hover:bg-sky-capella-50" aria-label="Ouvrir la fiche"><ArrowRight size={16}/></Link>
        </div>
      </div>
    </article>
  );
}

export default async function JourneePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  let prospectsQuery = (supabase as any)
    .from("prospects")
    .select("id, ref, raison_sociale, nom, prenom, mail, tel_mobile, tel_fixe, stage, next_action, next_action_date, last_action_at, date_fin_contrat, became_client_at, created_at, updated_at, segment, car_electricite, car_gaz, fournisseur_electricite, fournisseur_gaz, assigned_to")
    .is("deleted_at", null)
    .is("entered_conversion_at", null);
  if (profile.role !== "admin") prospectsQuery = prospectsQuery.eq("assigned_to", profile.id);

  let eventsQuery = (supabase as any)
    .from("calendar_events")
    .select("prospect_id, kind, title, start_at, end_at")
    .gte("end_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    .order("start_at", { ascending: true });
  if (profile.role !== "admin") eventsQuery = eventsQuery.eq("profile_id", profile.id);

  const [{ data: prospectData, error }, { data: eventData }] = await Promise.all([prospectsQuery, eventsQuery]);
  const prospects = (prospectData ?? []) as Row[];
  const events = (eventData ?? []) as DisciplineEvent[];
  const nextByProspect = new Map<string, DisciplineEvent>();
  for (const event of events) if (!nextByProspect.has(event.prospect_id)) nextByProspect.set(event.prospect_id, event);

  const items = prospects
    .map((prospect): WorkItem | null => {
      const event = nextByProspect.get(prospect.id) ?? null;
      const result = evaluateDiscipline(prospect, event);
      if (result.bucket === "ignore") return null;
      const bucket: WorkItem["bucket"] = result.bucket;
      return {
        prospect,
        event,
        priority: result.priority,
        bucket,
        reason: result.reason,
        detail: result.detail,
        urgent: result.urgent,
        anomaly: result.anomaly,
      };
    })
    .filter((item): item is WorkItem => Boolean(item))
    .sort((a, b) => b.priority - a.priority || label(a.prospect).localeCompare(label(b.prospect), "fr"));

  const maintenant = items.filter((x) => x.bucket === "maintenant");
  const travail = items.filter((x) => x.bucket === "travail");
  const reactiver = items.filter((x) => x.bucket === "reactiver");
  const anomalies = items.filter((x) => x.anomaly);
  const top = items[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-[1580px] px-4 py-6 lg:px-7 lg:py-8">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-star-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-star-700"><Target size={13}/>Cockpit commercial</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-navy-900">Ma journée</h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-500">Le CRM trie le travail par urgence commerciale. L’objectif : aucun prospect actif oublié, aucun engagement sans suite.</p>
        </div>
        {top ? <Link href={`/prospection/${top.prospect.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-star-500 px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(232,96,48,.20)] hover:bg-star-600"><Flame size={17}/>Traiter le prospect prioritaire<ArrowRight size={16}/></Link> : null}
      </header>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Lecture impossible : {error.message}</div> : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-star-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-star-700">À faire maintenant</span><Flame size={17} className="text-star-500"/></div><div className="mt-2 font-display text-3xl font-black text-navy-900">{maintenant.length}</div><div className="mt-1 text-xs text-grey-brand">Retards, RDV, rappels et dossiers chauds</div></div>
        <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-navy-500">À travailler</span><Target size={17} className="text-sky-capella-600"/></div><div className="mt-2 font-display text-3xl font-black text-navy-900">{travail.length}</div><div className="mt-1 text-xs text-grey-brand">Prospection active à poursuivre</div></div>
        <div className="rounded-2xl border border-sky-capella-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-sky-capella-700">À réactiver</span><RotateCcw size={17} className="text-sky-capella-600"/></div><div className="mt-2 font-display text-3xl font-black text-navy-900">{reactiver.length}</div><div className="mt-1 text-xs text-grey-brand">DDF à moins de 6 mois</div></div>
        <div className={`rounded-2xl border bg-white p-4 shadow-sm ${anomalies.length ? "border-red-200" : "border-green-200"}`}><div className="flex items-center justify-between"><span className={`text-xs font-bold uppercase tracking-wide ${anomalies.length ? "text-red-700" : "text-green-700"}`}>Anomalies</span><CircleAlert size={17} className={anomalies.length ? "text-red-500" : "text-green-500"}/></div><div className="mt-2 font-display text-3xl font-black text-navy-900">{anomalies.length}</div><div className="mt-1 text-xs text-grey-brand">La cible opérationnelle est 0</div></div>
      </section>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,.6fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-navy-900">À faire maintenant</h2><p className="text-xs text-grey-brand">Traite cette file de haut en bas.</p></div><span className="rounded-full bg-star-100 px-2.5 py-1 text-xs font-bold text-star-700">{maintenant.length}</span></div>
          {maintenant.length ? <div className="space-y-3">{maintenant.map((item, i) => <WorkCard key={item.prospect.id} item={item} rank={i + 1}/>)}</div> : <div className="rounded-2xl border border-dashed border-green-200 bg-green-50/50 p-10 text-center"><div className="font-display text-lg font-bold text-green-800">File critique vide</div><p className="mt-1 text-sm text-green-700">Aucun retard ou dossier sans prochaine action détecté.</p></div>}
        </section>

        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-navy-900">À réactiver</h2><p className="text-xs text-grey-brand">Les contrats futurs reviennent automatiquement dans le radar.</p></div><RotateCcw size={17} className="text-sky-capella-600"/></div>
            {reactiver.length ? <div className="space-y-3">{reactiver.slice(0, 8).map((item) => <WorkCard key={item.prospect.id} item={item}/>)}</div> : <div className="rounded-2xl border border-dashed border-navy-200 bg-white p-6 text-center text-sm text-grey-brand">Aucune DDF à réactiver dans les 6 prochains mois.</div>}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-bold text-navy-900">À travailler ensuite</h2><p className="text-xs text-grey-brand">Une fois la file critique terminée.</p></div><Clock3 size={17} className="text-navy-400"/></div>
            {travail.length ? <div className="space-y-3">{travail.slice(0, 8).map((item) => <WorkCard key={item.prospect.id} item={item}/>)}</div> : <div className="rounded-2xl border border-dashed border-navy-200 bg-white p-6 text-center text-sm text-grey-brand">Aucun dossier actif à reprendre.</div>}
          </section>
        </div>
      </div>
    </main>
  );
}
