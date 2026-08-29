import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlarmClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Phone,
} from "lucide-react";
import { peutGerer, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProspectStageEditor } from "@/components/prospect-stage-editor";
import { ProspectContactHeader } from "@/components/prospect-contact-header";
import { isTransferable } from "@/lib/domain/stages";
import { fmtDateHeure } from "@/lib/format";
import { nomComplet } from "@/lib/domain/noms";
import { BoutonSupprimer } from "../../admin/corbeille/bouton-supprimer";
import { ProspectInfoSidebar } from "@/components/prospect-info-sidebar";
import { ProspectActivity } from "@/components/prospect-activity";
import { ProspectTopbar } from "@/components/prospect-topbar";
import { CalendarPanel } from "@/components/calendar-panel";
import { ProspectToolsModal } from "@/components/prospect-tools-modal";
import { chargerSources, chargerChampsPersonnalises } from "@/lib/referentiels";
import { getCalendarAccount } from "@/lib/calendar";
import type { CalendarEvent, PieceJointe, Prospect, Profile } from "@/lib/domain/database.types";

export const dynamic = "force-dynamic";

type ActivityEmail = {
  id: string;
  direction: "incoming" | "outgoing";
  subject: string | null;
  snippet: string | null;
  sent_at: string | null;
  from_email: string | null;
};

function contactNom(p: Prospect): string {
  return nomComplet(p.nom, p.prenom) || "Contact non renseigné";
}

function calendarLabel(event: CalendarEvent): string {
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.start_at)).replace(",", " à");
  return event.kind === "rappel" ? `Rappel · ${date}` : `Présentation comparatif · ${date}`;
}

function formatCreated(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
  } catch { return value; }
}

function qualification(score: number | null): { label: string; className: string } | null {
  if (score == null) return null;
  if (score >= 4) return { label: "Chaud", className: "text-star-600" };
  if (score >= 3) return { label: "Tiède", className: "text-amber-600" };
  return { label: "Froid", className: "text-sky-capella-700" };
}

export default async function FicheProspectPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ acd?: string; calendar?: string; message?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const supabase = await createClient();

  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!prospect) notFound();

  const p = prospect as Prospect;
  const navigationSelection = "id, raison_sociale, nom, prenom";
  const plusRecent = `created_at.gt.${p.created_at},and(created_at.eq.${p.created_at},id.gt.${p.id})`;
  const plusAncien = `created_at.lt.${p.created_at},and(created_at.eq.${p.created_at},id.lt.${p.id})`;
  const calendarSince = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const [
    sources,
    { data: profils },
    { data: affaireLiee },
    { data: piecesData },
    champsPerso,
    calendarAccount,
    { data: calendarEventData },
    { data: activityEmailData },
    { data: fichePrecedente },
    { data: ficheSuivante },
  ] = await Promise.all([
    chargerSources(),
    estAdmin ? supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name") : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[] }),
    supabase.from("affaires").select("id, ref").eq("prospect_id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("pieces_jointes").select("*").eq("prospect_id", id).order("created_at", { ascending: false }),
    chargerChampsPersonnalises(),
    getCalendarAccount(profil.id).catch(() => null),
    supabase.from("calendar_events").select("*").eq("prospect_id", id).eq("profile_id", profil.id).gte("end_at", calendarSince).order("start_at", { ascending: true }).limit(20),
    supabase.from("email_messages").select("id, direction, subject, snippet, sent_at, from_email").eq("prospect_id", id).order("sent_at", { ascending: false }).limit(20),
    supabase.from("prospects").select(navigationSelection).is("deleted_at", null).or(plusRecent).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("prospects").select(navigationSelection).is("deleted_at", null).or(plusAncien).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const pretATransferer = isTransferable(p.stage);
  const pieces = (piecesData ?? []) as PieceJointe[];
  const piecesVisibles = estAdmin ? pieces : pieces.filter((x) => x.type !== "ACD");
  const calendarEvents = (calendarEventData ?? []) as CalendarEvent[];
  const activityEmails = (activityEmailData ?? []) as ActivityEmail[];
  const ownerName = estAdmin ? ((profils ?? []).find((x) => x.id === p.assigned_to)?.full_name ?? (p.assigned_to === profil.id ? profil.full_name : null)) : null;
  const sourceName = sources.find((s) => s.id === p.source_id)?.name ?? null;
  const phone = p.tel_mobile || p.tel_fixe;
  const prospectLabel = p.raison_sociale || contactNom(p);
  const prochaineAction = calendarEvents[0] ?? null;
  const nextComparatif = calendarEvents.find((event) => event.kind === "rdv") ?? null;
  const prochaineActionManuelle = !prochaineAction && p.next_action && !/^(Rappel|Présentation comparatif)/.test(p.next_action) ? p.next_action : null;
  const initials = (p.raison_sociale || p.nom || "C").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x.slice(0, 1)).join("").toUpperCase();
  const qualif = qualification(p.score);
  const relanceEnRetard = prochaineAction ? new Date(prochaineAction.start_at).getTime() < Date.now() : Boolean(p.next_action_date && p.next_action_date < new Date().toISOString().slice(0, 10));

  return (
    <main className="mx-auto w-full max-w-[1760px] px-4 py-4 lg:px-6 2xl:px-8">
      <ProspectTopbar />

      {query.acd === "transmise" ? <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Demande ACD transmise à l’administrateur.</div> : null}
      {query.calendar === "connecte" ? <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Google Calendar connecté à ton compte CRM.</div> : null}
      {query.calendar === "erreur" ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">Connexion Google Calendar impossible : {query.message || "erreur inconnue"}</div> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_370px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-[var(--crm-shadow-sm)] lg:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-2xl bg-sky-capella-600 font-display text-2xl font-bold text-white shadow-sm">{initials}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-bold leading-tight text-navy-900 lg:text-[30px]">{prospectLabel}</h1>
                    <ProspectStageEditor prospectId={p.id} stage={p.stage} />
                    {p.segment ? <span className="rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-600">{p.segment}</span> : null}
                    {p.ref ? <span className="text-[11px] font-semibold tabular text-grey-brand">{p.ref}</span> : null}
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-grey-brand">Créé le {formatCreated(p.created_at)}</div>
                  <ProspectContactHeader prospectId={p.id} prenom={p.prenom} nom={p.nom} mail={p.mail} mobile={p.tel_mobile || p.tel_fixe} />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 xl:flex-col xl:items-end">
                {p.score == null ? <div className="rounded-xl border border-dashed border-navy-200 bg-navy-50 px-3 py-2 text-right"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy-400">Score</div><div className="mt-1 text-xs font-semibold text-navy-500">Non renseigné</div></div> : <><div className="flex h-[74px] w-[74px] items-center justify-center rounded-full border-[6px] border-star-100 bg-white font-display text-xl font-bold text-star-600 shadow-sm">{p.score}/5</div><div className="text-right"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-grey-brand">Score</div>{qualif ? <div className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${qualif.className}`}>{qualif.label}{qualif.label === "Chaud" ? <Flame size={13}/> : null}</div> : null}</div></>}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-navy-100 pt-5">
              {phone ? <a href={`tel:${phone}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-bold text-white shadow-sm hover:bg-navy-700"><Phone size={16}/>Appeler</a> : null}
              <ProspectToolsModal prospectId={p.id} prospectLabel={prospectLabel} />
              <CalendarPanel prospectId={p.id} prospectEmail={p.mail} prospectLabel={prospectLabel} connected={Boolean(calendarAccount)} accountEmail={calendarAccount?.email || null} events={calendarEvents} />
            </div>
          </section>

          <section className={`flex flex-col gap-4 rounded-2xl border px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${(prochaineAction || prochaineActionManuelle || p.next_action_date) ? (relanceEnRetard ? "border-star-300 bg-star-50" : "border-star-200 bg-[#FFF9F5]") : "border-navy-100 bg-white"}`}>
            <div className="flex min-w-0 items-center gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${(prochaineAction || prochaineActionManuelle || p.next_action_date) ? "bg-star-100 text-star-600" : "bg-navy-50 text-navy-400"}`}>{prochaineAction?.kind === "rdv" ? <CalendarDays size={20}/> : <AlarmClock size={20}/>}</div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy-500">Prochaine action</div>
                {(prochaineAction || prochaineActionManuelle || p.next_action_date) ? <><div className="mt-1 text-sm font-bold text-navy-900">{prochaineAction ? calendarLabel(prochaineAction) : prochaineActionManuelle || "Relance à effectuer"}</div>{!prochaineAction && p.next_action_date ? <div className="mt-0.5 text-xs font-medium text-star-700">RDV comparatif : {p.next_action_date}{relanceEnRetard ? " · en retard" : ""}</div> : null}</> : <div className="mt-1 text-sm font-semibold text-navy-500">Aucune action programmée</div>}
              </div>
            </div>
            <Link href="/agenda" className={`inline-flex h-9 shrink-0 items-center justify-center rounded-xl px-4 text-xs font-bold ${(prochaineAction || prochaineActionManuelle || p.next_action_date) ? "bg-star-500 text-white hover:bg-star-600" : "border border-navy-200 bg-white text-navy-700 hover:bg-navy-50"}`}>Ouvrir l’agenda</Link>
          </section>

          {affaireLiee ? <Link href={`/conversion/${affaireLiee.id}`} className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 hover:bg-green-100"><span><strong>Dossier déjà converti</strong><span className="ml-2 text-xs">{affaireLiee.ref}</span></span><ChevronRight size={17}/></Link> : pretATransferer ? <section className="flex flex-col gap-3 rounded-xl border border-sky-capella-200 bg-sky-capella-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm text-navy-900">Prêt à convertir en affaire</strong><p className="mt-0.5 text-xs text-navy-500">La fiche affaire sera pré-remplie avec les données connues.</p></div><Link href={`/conversion/nouvelle?prospect=${p.id}`} className="inline-flex h-9 items-center justify-center rounded-xl bg-navy-900 px-4 text-xs font-bold text-white hover:bg-navy-700">Convertir</Link></section> : null}

          {p.stage === "Demande ACD" ? <section className="rounded-xl border border-star-200 bg-star-50 px-4 py-3">{estAdmin ? <a href={`/api/acd/${p.id}`} className="inline-flex h-9 items-center justify-center rounded-xl bg-star-500 px-4 text-xs font-bold text-white hover:bg-star-600">Télécharger l’ACD</a> : <form action={`/api/acd/${p.id}/demander`} method="post"><button type="submit" className="inline-flex h-9 items-center justify-center rounded-xl bg-star-500 px-4 text-xs font-bold text-white hover:bg-star-600">Demander l&apos;ACD</button></form>}</section> : null}

          <ProspectActivity prospectId={p.id} emails={activityEmails} events={calendarEvents} pieces={piecesVisibles} />

          {peutGerer(profil) ? <div className="px-1"><BoutonSupprimer cible="prospect" id={p.id} libelle={prospectLabel} retour="/prospection" /></div> : null}
        </div>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="inline-flex overflow-hidden rounded-xl border border-navy-200 bg-white shadow-sm">
              {fichePrecedente ? <Link href={`/prospection/${fichePrecedente.id}`} className="inline-flex h-9 w-10 items-center justify-center text-navy-700 hover:bg-sky-capella-50" title="Prospect précédent"><ChevronLeft size={18}/></Link> : <span className="inline-flex h-9 w-10 items-center justify-center text-navy-200"><ChevronLeft size={18}/></span>}
              <span className="w-px bg-navy-100" />
              {ficheSuivante ? <Link href={`/prospection/${ficheSuivante.id}`} className="inline-flex h-9 w-10 items-center justify-center text-navy-700 hover:bg-sky-capella-50" title="Prospect suivant"><ChevronRight size={18}/></Link> : <span className="inline-flex h-9 w-10 items-center justify-center text-navy-200"><ChevronRight size={18}/></span>}
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-navy-500 shadow-sm ring-1 ring-navy-100"><Clock3 size={12}/>Dernière action {fmtDateHeure(p.last_action_at)}</div>
          </div>
          <ProspectInfoSidebar prospect={p} ownerName={ownerName} sourceName={sourceName} nextComparatif={nextComparatif} isAdmin={estAdmin} champsPerso={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))} />
        </aside>
      </div>
    </main>
  );
}
