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
import { EmailClient } from "@/components/email-client";
import { ProspectInfoSidebar } from "@/components/prospect-info-sidebar";
import { ProspectNoteEditor } from "@/components/prospect-note-editor";
import { CalendarPanel } from "@/components/calendar-panel";
import { chargerSources, chargerChampsPersonnalises } from "@/lib/referentiels";
import { getActiveGmailAccount } from "@/lib/gmail";
import { getCalendarAccount } from "@/lib/calendar";
import type { CalendarEvent, EmailMessage, EmailTemplate, PieceJointe, Prospect, Profile } from "@/lib/domain/database.types";

export const dynamic = "force-dynamic";

function contactNom(p: Prospect): string {
  return nomComplet(p.nom, p.prenom) || "Contact non renseigné";
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
    { data: templateData },
    { data: messageData },
    gmailAccount,
    calendarAccount,
    { data: calendarEventData },
    { data: fichePrecedente },
    { data: ficheSuivante },
  ] = await Promise.all([
    chargerSources(),
    estAdmin ? supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name") : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[] }),
    supabase.from("affaires").select("id, ref").eq("prospect_id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("pieces_jointes").select("*").eq("prospect_id", id).order("created_at"),
    chargerChampsPersonnalises(),
    supabase.from("email_templates").select("*").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("email_messages").select("*").eq("prospect_id", id).order("sent_at", { ascending: false }).limit(100),
    getActiveGmailAccount().catch(() => null),
    getCalendarAccount(profil.id).catch(() => null),
    supabase.from("calendar_events").select("*").eq("prospect_id", id).eq("profile_id", profil.id).gte("end_at", calendarSince).order("start_at", { ascending: true }).limit(20),
    supabase
      .from("prospects")
      .select(navigationSelection)
      .is("deleted_at", null)
      .or(plusRecent)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("prospects")
      .select(navigationSelection)
      .is("deleted_at", null)
      .or(plusAncien)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const pretATransferer = isTransferable(p.stage);
  const pieces = (piecesData ?? []) as PieceJointe[];
  const piecesVisibles = estAdmin ? pieces : pieces.filter((x) => x.type !== "ACD");
  const templates = (templateData ?? []) as EmailTemplate[];
  const messages = (messageData ?? []) as EmailMessage[];
  const calendarEvents = (calendarEventData ?? []) as CalendarEvent[];
  const fournisseur = p.fournisseur_electricite || p.fournisseur_gaz || "";
  const ownerName = p.assigned_to === profil.id
    ? profil.full_name
    : (profils ?? []).find((x) => x.id === p.assigned_to)?.full_name ?? null;
  const sourceName = sources.find((s) => s.id === p.source_id)?.name ?? null;
  const phone = p.tel_mobile || p.tel_fixe;
  const prospectLabel = p.raison_sociale || contactNom(p);
  const variables: Record<string, string> = {
    prenom: p.prenom || "",
    nom: p.nom || "",
    societe: p.raison_sociale || "",
    email: p.mail || "",
    commercial: profil.full_name,
    ref: p.ref || "",
    siren: p.siren || "",
    pdl: p.pdl || "",
    pce: p.pce || "",
    fournisseur,
    date_echeance: p.date_fin_contrat || "",
  };

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 py-5 2xl:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/prospection" className="text-sm text-grey-brand underline underline-offset-2 hover:text-navy-700">← Retour à la prospection</Link>
        <div className="flex items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border border-navy-200 bg-white">
            {fichePrecedente ? (
              <Link
                href={`/prospection/${fichePrecedente.id}`}
                className="inline-flex h-9 w-10 items-center justify-center text-xl font-semibold text-navy-700 hover:bg-navy-50"
                title={`Fiche précédente : ${fichePrecedente.raison_sociale || nomComplet(fichePrecedente.nom, fichePrecedente.prenom)}`}
                aria-label="Fiche précédente"
              >
                ‹
              </Link>
            ) : (
              <span className="inline-flex h-9 w-10 cursor-not-allowed items-center justify-center text-xl text-navy-200" aria-hidden>‹</span>
            )}
            <span className="w-px bg-navy-100" />
            {ficheSuivante ? (
              <Link
                href={`/prospection/${ficheSuivante.id}`}
                className="inline-flex h-9 w-10 items-center justify-center text-xl font-semibold text-navy-700 hover:bg-navy-50"
                title={`Fiche suivante : ${ficheSuivante.raison_sociale || nomComplet(ficheSuivante.nom, ficheSuivante.prenom)}`}
                aria-label="Fiche suivante"
              >
                ›
              </Link>
            ) : (
              <span className="inline-flex h-9 w-10 cursor-not-allowed items-center justify-center text-xl text-navy-200" aria-hidden>›</span>
            )}
          </div>
          <div className="text-xs text-grey-brand">Dernière action {fmtDateHeure(p.last_action_at)}</div>
        </div>
      </div>

      {query.acd === "transmise" ? (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Demande ACD transmise à l’administrateur.</div>
      ) : null}
      {query.calendar === "connecte" ? (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Google Calendar connecté à ton compte CRM.</div>
      ) : null}
      {query.calendar === "erreur" ? (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">Connexion Google Calendar impossible : {query.message || "erreur inconnue"}</div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[270px_minmax(0,1fr)_360px]">
        <aside className="space-y-4 xl:sticky xl:top-5">
          <section className="rounded-xl border border-navy-100 bg-white p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 font-display text-lg font-bold text-navy-700">
              {(p.raison_sociale || p.nom || "C").slice(0, 1).toUpperCase()}
            </div>
            <h1 className="mt-3 font-display text-xl font-bold leading-tight text-navy-800">{p.raison_sociale || contactNom(p)}</h1>
            <p className="mt-1 text-sm font-medium text-grey-brand">{contactNom(p)}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StageBadge label={p.stage} color={stageColor(p.stage, "prospect")} />
              {p.ref ? <span className="text-xs tabular text-grey-brand">{p.ref}</span> : null}
            </div>

            <div className="mt-4 space-y-2 border-t border-navy-100 pt-4 text-sm">
              {p.mail ? <a href={`mailto:${p.mail}`} className="block truncate text-navy-700 underline underline-offset-2" title={p.mail}>{p.mail}</a> : <span className="block text-grey-brand">Email non renseigné</span>}
              {phone ? <a href={`tel:${phone}`} className="block font-semibold text-navy-800">{phone}</a> : <span className="block text-grey-brand">Téléphone non renseigné</span>}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {phone ? <a href={`tel:${phone}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-navy-200 bg-white px-2 text-xs font-semibold text-navy-700 hover:bg-navy-50">Appeler</a> : null}
              <a href="#email-composer" className="inline-flex h-9 items-center justify-center rounded-lg border border-navy-200 bg-white px-2 text-xs font-semibold text-navy-700 hover:bg-navy-50">E-mail</a>
              <Link href={`/outils/comparatif?prospect=${p.id}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-navy-200 bg-white px-2 text-xs font-semibold text-navy-700 hover:bg-navy-50">Comparatif</Link>
              <Link href={`/outils/resiliation?prospect=${p.id}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-navy-200 bg-white px-2 text-xs font-semibold text-navy-700 hover:bg-navy-50">Résiliation</Link>
            </div>

            <div className="mt-2">
              <CalendarPanel
                prospectId={p.id}
                prospectEmail={p.mail}
                prospectLabel={prospectLabel}
                connected={Boolean(calendarAccount)}
                accountEmail={calendarAccount?.email || null}
                events={calendarEvents}
              />
            </div>

            {p.stage === "Demande ACD" ? (
              <div className="mt-2">
                {estAdmin ? (
                  <a href={`/api/acd/${p.id}`} className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-star-500 px-3 text-xs font-semibold text-white hover:bg-star-600">Télécharger l’ACD</a>
                ) : (
                  <form action={`/api/acd/${p.id}/demander`} method="post">
                    <button type="submit" className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-star-500 px-3 text-xs font-semibold text-white hover:bg-star-600">Demander l&apos;ACD</button>
                  </form>
                )}
              </div>
            ) : null}
          </section>

          <ProspectNoteEditor prospectId={p.id} initialNotes={p.notes} />

          {(p.next_action || p.next_action_date) ? (
            <section className="rounded-xl border border-star-200 bg-star-50/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-grey-brand">À faire</div>
              <div className="mt-1 text-sm font-semibold text-navy-800">{p.next_action || "Prochaine action"}</div>
              {p.next_action_date ? <div className="mt-1 text-xs text-grey-brand">Prévue le {p.next_action_date}</div> : null}
            </section>
          ) : null}

          {affaireLiee ? (
            <Link href={`/conversion/${affaireLiee.id}`} className="block rounded-xl p-4 text-sm text-navy-800 hover:opacity-90" style={{ backgroundColor: "var(--color-status-signe)" }}>
              <strong>Déjà converti en affaire</strong>
              <span className="mt-1 block text-xs">Voir {affaireLiee.ref} →</span>
            </Link>
          ) : pretATransferer ? (
            <section className="rounded-xl p-4 text-sm text-navy-800" style={{ backgroundColor: "var(--color-status-avance)" }}>
              <strong>Prêt à convertir</strong>
              <p className="mt-1 text-xs">La fiche affaire sera pré-remplie.</p>
              <Link href={`/conversion/nouvelle?prospect=${p.id}`} className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-star-500 px-3 text-xs font-semibold text-white hover:bg-star-600">Convertir en affaire</Link>
            </section>
          ) : null}

          {peutGerer(profil) ? (
            <div className="px-1"><BoutonSupprimer cible="prospect" id={p.id} libelle={p.raison_sociale || contactNom(p)} retour="/prospection" /></div>
          ) : null}
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="font-display text-xl font-bold text-navy-800">Activité & échanges</h2>
              <p className="text-xs text-grey-brand">Le fil de travail principal de cette relation client.</p>
            </div>
            <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-700">E-mails</span>
          </div>
          <EmailClient
            prospectId={p.id}
            prospectEmail={p.mail}
            variables={variables}
            templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body }))}
            messages={messages}
            pieces={piecesVisibles.map((piece) => ({ id: piece.id, file_name: piece.file_name, type: piece.type }))}
            gmailConnected={Boolean(gmailAccount)}
            estAdmin={estAdmin}
          />
        </section>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto xl:pr-1">
          <ProspectInfoSidebar
            prospect={p}
            ownerName={ownerName}
            sourceName={sourceName}
            champsPerso={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))}
          />
          <PiecesJointes scope="prospect" parentId={p.id} pieces={piecesVisibles} compact />
        </aside>
      </div>
    </main>
  );
}
