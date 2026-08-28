import Link from "next/link";
import { notFound } from "next/navigation";
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.start_at)).replace(",", " à");
  return event.kind === "rappel" ? `Rappel — ${date}` : `Présentation comparatif — ${date}`;
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
  const prochaineActionManuelle = !prochaineAction && p.next_action && !/^(Rappel|Présentation comparatif)/.test(p.next_action)
    ? p.next_action
    : null;

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 py-5 2xl:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/prospection" className="text-sm text-grey-brand underline underline-offset-2 hover:text-navy-700">← Retour à la prospection</Link>
        <div className="flex items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border border-navy-200 bg-white">
            {fichePrecedente ? <Link href={`/prospection/${fichePrecedente.id}`} className="inline-flex h-9 w-10 items-center justify-center text-xl font-semibold text-navy-700 hover:bg-navy-50" title={`Fiche précédente : ${fichePrecedente.raison_sociale || nomComplet(fichePrecedente.nom, fichePrecedente.prenom)}`}>‹</Link> : <span className="inline-flex h-9 w-10 items-center justify-center text-xl text-navy-200">‹</span>}
            <span className="w-px bg-navy-100" />
            {ficheSuivante ? <Link href={`/prospection/${ficheSuivante.id}`} className="inline-flex h-9 w-10 items-center justify-center text-xl font-semibold text-navy-700 hover:bg-navy-50" title={`Fiche suivante : ${ficheSuivante.raison_sociale || nomComplet(ficheSuivante.nom, ficheSuivante.prenom)}`}>›</Link> : <span className="inline-flex h-9 w-10 items-center justify-center text-xl text-navy-200">›</span>}
          </div>
          <div className="text-xs text-grey-brand">Dernière action {fmtDateHeure(p.last_action_at)}</div>
        </div>
      </div>

      {query.acd === "transmise" ? <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Demande ACD transmise à l’administrateur.</div> : null}
      {query.calendar === "connecte" ? <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Google Calendar connecté à ton compte CRM.</div> : null}
      {query.calendar === "erreur" ? <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">Connexion Google Calendar impossible : {query.message || "erreur inconnue"}</div> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[290px_minmax(0,1fr)_360px]">
        <aside className="space-y-4 xl:sticky xl:top-5">
          <section className="rounded-xl border border-navy-100 bg-white p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 font-display text-lg font-bold text-navy-700">{(p.raison_sociale || p.nom || "C").slice(0, 1).toUpperCase()}</div>
            <h1 className="mt-3 font-display text-xl font-bold leading-tight text-navy-800">{prospectLabel}</h1>
            <p className="mt-1 text-sm font-medium text-grey-brand">{contactNom(p)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><StageBadge label={p.stage} color={stageColor(p.stage, "prospect")} />{p.ref ? <span className="text-xs tabular text-grey-brand">{p.ref}</span> : null}</div>

            <div className="mt-4 space-y-2 border-t border-navy-100 pt-4 text-sm">
              {p.mail ? <span className="block truncate text-navy-700" title={p.mail}>{p.mail}</span> : <span className="block text-grey-brand">Email non renseigné</span>}
              {phone ? <a href={`tel:${phone}`} className="block font-semibold text-navy-800">{phone}</a> : <span className="block text-grey-brand">Téléphone non renseigné</span>}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {phone ? <a href={`tel:${phone}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-navy-200 bg-white px-2 text-xs font-semibold text-navy-700 hover:bg-navy-50">📞 Appeler</a> : null}
              <ProspectToolsModal prospectId={p.id} prospectLabel={prospectLabel} />
              <CalendarPanel prospectId={p.id} prospectEmail={p.mail} prospectLabel={prospectLabel} connected={Boolean(calendarAccount)} accountEmail={calendarAccount?.email || null} events={calendarEvents} />
            </div>

            {prochaineAction ? (
              <div className={`mt-4 rounded-lg border px-3 py-2.5 ${prochaineAction.kind === "rappel" ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50"}`}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-grey-brand">Prochaine action</div>
                <div className="mt-1 flex items-start gap-2 text-xs font-semibold text-navy-800">
                  <span aria-hidden>{prochaineAction.kind === "rappel" ? "⏰" : "📅"}</span>
                  <span>{calendarLabel(prochaineAction)}</span>
                </div>
              </div>
            ) : prochaineActionManuelle ? (
              <div className="mt-4 rounded-lg border border-navy-100 bg-navy-50/60 px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-grey-brand">Prochaine action</div>
                <div className="mt-1 text-xs font-semibold text-navy-800">{prochaineActionManuelle}</div>
              </div>
            ) : null}

            {p.stage === "Demande ACD" ? <div className="mt-2">{estAdmin ? <a href={`/api/acd/${p.id}`} className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-star-500 px-3 text-xs font-semibold text-white hover:bg-star-600">Télécharger l’ACD</a> : <form action={`/api/acd/${p.id}/demander`} method="post"><button type="submit" className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-star-500 px-3 text-xs font-semibold text-white hover:bg-star-600">Demander l&apos;ACD</button></form>}</div> : null}
          </section>

          {affaireLiee ? <Link href={`/conversion/${affaireLiee.id}`} className="block rounded-xl p-4 text-sm text-navy-800 hover:opacity-90" style={{ backgroundColor: "var(--color-status-signe)" }}><strong>Déjà converti en affaire</strong><span className="mt-1 block text-xs">Voir {affaireLiee.ref} →</span></Link> : pretATransferer ? <section className="rounded-xl p-4 text-sm text-navy-800" style={{ backgroundColor: "var(--color-status-avance)" }}><strong>Prêt à convertir</strong><p className="mt-1 text-xs">La fiche affaire sera pré-remplie.</p><Link href={`/conversion/nouvelle?prospect=${p.id}`} className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-star-500 px-3 text-xs font-semibold text-white hover:bg-star-600">Convertir en affaire</Link></section> : null}

          {peutGerer(profil) ? <div className="px-1"><BoutonSupprimer cible="prospect" id={p.id} libelle={prospectLabel} retour="/prospection" /></div> : null}
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="font-display text-xl font-bold text-navy-800">Activité & échanges</h2>
              <p className="text-xs text-grey-brand">Vue rapide de la relation. Les outils complets s’ouvrent dans les fenêtres d’action.</p>
            </div>
            <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-700">{activityEmails.length} récent{activityEmails.length > 1 ? "s" : ""}</span>
          </div>

          <div className="mb-4">
            <ProspectNoteEditor prospectId={p.id} initialNotes={p.notes} />
          </div>

          <div className="rounded-xl border border-navy-100 bg-white">
            {activityEmails.length ? (
              <div className="divide-y divide-navy-100">
                {activityEmails.map((email) => (
                  <article key={email.id} className="p-4 hover:bg-navy-50/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${email.direction === "incoming" ? "bg-star-100 text-star-800" : "bg-navy-100 text-navy-700"}`}>
                            {email.direction === "incoming" ? "Reçu" : "Envoyé"}
                          </span>
                          <strong className="truncate text-sm text-navy-800">{email.subject || "Sans objet"}</strong>
                        </div>
                        {email.snippet ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-grey-brand">{email.snippet}</p> : null}
                      </div>
                      <span className="shrink-0 text-[11px] text-grey-brand">{fmtDateHeure(email.sent_at)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <div className="text-2xl">✉️</div>
                <p className="mt-2 text-sm font-semibold text-navy-700">Aucun échange enregistré</p>
                <p className="mt-1 text-xs text-grey-brand">Utilise le bouton Email en haut à gauche pour envoyer ou synchroniser les échanges.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto xl:pr-1">
          <ProspectInfoSidebar prospect={p} ownerName={ownerName} sourceName={sourceName} champsPerso={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))} />
          <PiecesJointes scope="prospect" parentId={p.id} pieces={piecesVisibles} compact />
        </aside>
      </div>
    </main>
  );
}
