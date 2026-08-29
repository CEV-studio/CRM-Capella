import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  AlarmClock,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { peutGerer, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StageBadge } from "@/components/ui";
import { isTransferable, stageColor } from "@/lib/domain/stages";
import { fmtDateHeure } from "@/lib/format";
import { nomComplet } from "@/lib/domain/noms";
import { BoutonSupprimer } from "../../admin/corbeille/bouton-supprimer";
import { PiecesJointes } from "@/components/pieces-jointes";
import { ProspectInfoSidebar } from "@/components/prospect-info-sidebar";
import { ProspectNoteEditor } from "@/components/prospect-note-editor";
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
    supabase.from("pieces_jointes").select("*").eq("prospect_id", id).order("created_at"),
    chargerChampsPersonnalises(),
    getCalendarAccount(profil.id).catch(() => null),
    supabase.from("calendar_events").select("*").eq("prospect_id", id).eq("profile_id", profil.id).gte("end_at", calendarSince).order("start_at", { ascending: true }).limit(20),
    supabase.from("email_messages").select("id, direction, subject, snippet, sent_at, from_email").eq("prospect_id", id).order("sent_at", { ascending: false }).limit(12),
    supabase.from("prospects").select(navigationSelection).is("deleted_at", null).or(plusRecent).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("prospects").select(navigationSelection).is("deleted_at", null).or(plusAncien).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const pretATransferer = isTransferable(p.stage);
  const pieces = (piecesData ?? []) as PieceJointe[];
  const piecesVisibles = estAdmin ? pieces : pieces.filter((x) => x.type !== "ACD");
  const calendarEvents = (calendarEventData ?? []) as CalendarEvent[];
  const activityEmails = (activityEmailData ?? []) as ActivityEmail[];
  const ownerName = p.assigned_to === profil.id ? profil.full_name : (profils ?? []).find((x) => x.id === p.assigned_to)?.full_name ?? null;
  const sourceName = sources.find((s) => s.id === p.source_id)?.name ?? null;
  const phone = p.tel_mobile || p.tel_fixe;
  const prospectLabel = p.raison_sociale || contactNom(p);
  const prochaineAction = calendarEvents[0] ?? null;
  const prochaineActionManuelle = !prochaineAction && p.next_action && !/^(Rappel|Présentation comparatif)/.test(p.next_action) ? p.next_action : null;
  const initials = (p.raison_sociale || p.nom || "C").split(/\s+/).slice(0, 2).map((x) => x.slice(0, 1)).join("").toUpperCase();

  return (
    <main className="mx-auto w-full max-w-[1760px] px-4 py-5 lg:px-6 2xl:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/prospection" className="inline-flex items-center gap-2 text-sm font-semibold text-navy-500 transition hover:text-star-600">
          <ArrowLeft size={16} /> Retour aux prospects
        </Link>
        <div className="flex items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-xl border border-navy-200 bg-white shadow-sm">
            {fichePrecedente ? (
              <Link href={`/prospection/${fichePrecedente.id}`} className="inline-flex h-9 w-10 items-center justify-center text-navy-700 transition hover:bg-sky-capella-50 hover:text-sky-capella-700" title={`Fiche précédente : ${fichePrecedente.raison_sociale || nomComplet(fichePrecedente.nom, fichePrecedente.prenom)}`}>
                <ChevronLeft size={18} />
              </Link>
            ) : <span className="inline-flex h-9 w-10 items-center justify-center text-navy-200"><ChevronLeft size={18} /></span>}
            <span className="w-px bg-navy-100" />
            {ficheSuivante ? (
              <Link href={`/prospection/${ficheSuivante.id}`} className="inline-flex h-9 w-10 items-center justify-center text-navy-700 transition hover:bg-sky-capella-50 hover:text-sky-capella-700" title={`Fiche suivante : ${ficheSuivante.raison_sociale || nomComplet(ficheSuivante.nom, ficheSuivante.prenom)}`}>
                <ChevronRight size={18} />
              </Link>
            ) : <span className="inline-flex h-9 w-10 items-center justify-center text-navy-200"><ChevronRight size={18} /></span>}
          </div>
          <div className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-navy-500 shadow-sm ring-1 ring-navy-100 sm:flex">
            <Clock3 size={13} /> Dernière action {fmtDateHeure(p.last_action_at)}
          </div>
        </div>
      </div>

      {query.acd === "transmise" ? <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Demande ACD transmise à l’administrateur.</div> : null}
      {query.calendar === "connecte" ? <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Google Calendar connecté à ton compte CRM.</div> : null}
      {query.calendar === "erreur" ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">Connexion Google Calendar impossible : {query.message || "erreur inconnue"}</div> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-[var(--shadow-card)] lg:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-capella-600 to-sky-capella-400 font-display text-xl font-bold text-white shadow-lg shadow-sky-capella-500/15">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-bold leading-tight text-navy-900 lg:text-[28px]">{prospectLabel}</h1>
                    <StageBadge label={p.stage} color={stageColor(p.stage, "prospect")} />
                    {p.segment ? <span className="rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-600">{p.segment}</span> : null}
                    {p.ref ? <span className="text-[11px] font-semibold tabular text-grey-brand">{p.ref}</span> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-navy-600">
                    <span className="inline-flex items-center gap-2"><UserRound size={16} className="text-navy-400" />{contactNom(p)}</span>
                    {ownerName ? <span className="inline-flex items-center gap-2"><Activity size={16} className="text-navy-400" />{ownerName}</span> : null}
                    {phone ? <a href={`tel:${phone}`} className="inline-flex items-center gap-2 font-semibold text-navy-700 hover:text-sky-capella-700"><Phone size={16} />{phone}</a> : null}
                    {p.mail ? <a href={`mailto:${p.mail}`} className="inline-flex max-w-full items-center gap-2 font-medium text-navy-700 hover:text-sky-capella-700"><Mail size={16} /><span className="truncate">{p.mail}</span></a> : null}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 xl:flex-col xl:items-end">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-star-100 bg-white font-display text-xl font-bold text-star-600 shadow-sm">
                  {p.score == null ? "—" : `${p.score}/5`}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-grey-brand">Score</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-navy-100 pt-5">
              {phone ? <a href={`tel:${phone}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-navy-700"><Phone size={16} />Appeler</a> : null}
              <ProspectToolsModal prospectId={p.id} prospectLabel={prospectLabel} />
              <CalendarPanel prospectId={p.id} prospectEmail={p.mail} prospectLabel={prospectLabel} connected={Boolean(calendarAccount)} accountEmail={calendarAccount?.email || null} events={calendarEvents} />
              {p.stage === "Demande ACD" ? estAdmin ? (
                <a href={`/api/acd/${p.id}`} className="inline-flex h-10 items-center justify-center rounded-xl bg-star-500 px-4 text-sm font-bold text-white shadow-sm hover:bg-star-600">Télécharger l’ACD</a>
              ) : (
                <form action={`/api/acd/${p.id}/demander`} method="post"><button type="submit" className="inline-flex h-10 items-center justify-center rounded-xl bg-star-500 px-4 text-sm font-bold text-white shadow-sm hover:bg-star-600">Demander l&apos;ACD</button></form>
              ) : null}
            </div>
          </section>

          {(prochaineAction || prochaineActionManuelle || p.next_action_date) ? (
            <section className="flex flex-col gap-4 rounded-2xl border border-star-200 bg-gradient-to-r from-star-50 via-white to-sky-capella-50/40 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-star-100 text-star-600">
                  {prochaineAction?.kind === "rdv" ? <CalendarDays size={20} /> : <AlarmClock size={20} />}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-navy-500">Prochaine action</div>
                  <div className="mt-1 text-sm font-bold text-navy-900">
                    {prochaineAction ? calendarLabel(prochaineAction) : prochaineActionManuelle || "Relance à effectuer"}
                  </div>
                  {!prochaineAction && p.next_action_date ? <div className="mt-0.5 text-xs font-medium text-star-700">Date de relance : {p.next_action_date}</div> : null}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-star-500 px-3 py-1.5 text-[11px] font-bold text-white">Priorité commerciale</span>
            </section>
          ) : null}

          {affaireLiee ? (
            <Link href={`/conversion/${affaireLiee.id}`} className="flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-900 transition hover:bg-green-100">
              <span><strong>Dossier déjà converti</strong><span className="ml-2 text-xs">{affaireLiee.ref}</span></span><ChevronRight size={17} />
            </Link>
          ) : pretATransferer ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-sky-capella-200 bg-sky-capella-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div><strong className="text-sm text-navy-900">Prêt à convertir en affaire</strong><p className="mt-0.5 text-xs text-navy-500">La fiche affaire sera pré-remplie avec les données connues.</p></div>
              <Link href={`/conversion/nouvelle?prospect=${p.id}`} className="inline-flex h-9 items-center justify-center rounded-xl bg-navy-900 px-4 text-xs font-bold text-white hover:bg-navy-700">Convertir</Link>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-navy-900">Activité & échanges</h2>
                <p className="mt-0.5 text-xs text-grey-brand">Notes commerciales et échanges récents avec ce prospect.</p>
              </div>
              <span className="rounded-full bg-sky-capella-50 px-3 py-1 text-xs font-bold text-sky-capella-700">{activityEmails.length} échange{activityEmails.length > 1 ? "s" : ""}</span>
            </div>

            <div className="p-4 sm:p-5">
              <ProspectNoteEditor prospectId={p.id} initialNotes={p.notes} />
            </div>

            <div className="border-t border-navy-100 px-4 py-3 sm:px-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-navy-500">Historique récent</h3>
                <span className="text-[11px] text-grey-brand">Emails synchronisés</span>
              </div>
              {activityEmails.length ? (
                <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-navy-100">
                  {activityEmails.map((email) => (
                    <article key={email.id} className="relative flex gap-3 rounded-xl border border-navy-100 bg-white p-3 transition hover:border-sky-capella-200 hover:bg-sky-capella-50/30">
                      <div className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${email.direction === "incoming" ? "bg-star-50 text-star-600" : "bg-sky-capella-50 text-sky-capella-700"}`}>
                        <Mail size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-navy-400">{email.direction === "incoming" ? "Email reçu" : "Email envoyé"}</span></div>
                            <strong className="mt-0.5 block truncate text-sm text-navy-900">{email.subject || "Sans objet"}</strong>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold text-grey-brand">{fmtDateHeure(email.sent_at)}</span>
                        </div>
                        {email.snippet ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-navy-500">{email.snippet}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-navy-50 px-5 py-8 text-center">
                  <Mail size={22} className="mx-auto text-navy-300" />
                  <p className="mt-2 text-sm font-bold text-navy-700">Aucun échange enregistré</p>
                  <p className="mt-1 text-xs text-grey-brand">Utilise E-mail pour envoyer ou synchroniser les échanges.</p>
                </div>
              )}
            </div>
          </section>

          {peutGerer(profil) ? <div className="px-1"><BoutonSupprimer cible="prospect" id={p.id} libelle={prospectLabel} retour="/prospection" /></div> : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto xl:pr-1">
          <ProspectInfoSidebar prospect={p} ownerName={ownerName} sourceName={sourceName} champsPerso={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))} />
          <PiecesJointes scope="prospect" parentId={p.id} pieces={piecesVisibles} compact />
        </aside>
      </div>
    </main>
  );
}
