import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCalendarAccount } from "@/lib/calendar";
import { fmtDateHeure } from "@/lib/format";
import { nomComplet } from "@/lib/domain/noms";
import type { CalendarEvent } from "@/lib/domain/database.types";

export const dynamic = "force-dynamic";

function eventClasses(kind: CalendarEvent["kind"]) {
  return kind === "rappel"
    ? "border-amber-200 bg-amber-50/80"
    : "border-sky-200 bg-sky-50/80";
}

export default async function AgendaPage({ searchParams }: {
  searchParams: Promise<{ calendar?: string; message?: string }>;
}) {
  const query = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const [account, { data: eventData }] = await Promise.all([
    getCalendarAccount(profile.id).catch(() => null),
    supabase
      .from("calendar_events")
      .select("*")
      .eq("profile_id", profile.id)
      .gte("end_at", since)
      .order("start_at", { ascending: true })
      .limit(100),
  ]);

  const events = (eventData ?? []) as CalendarEvent[];
  const prospectIds = [...new Set(events.map((event) => event.prospect_id))];
  const { data: prospects } = prospectIds.length
    ? await supabase.from("prospects").select("id, raison_sociale, nom, prenom").in("id", prospectIds).is("deleted_at", null)
    : { data: [] as Array<{ id:string; raison_sociale:string|null; nom:string|null; prenom:string|null }> };
  const prospectMap = new Map((prospects ?? []).map((p) => [p.id, p]));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800">Mon agenda</h1>
          <p className="mt-1 text-sm text-grey-brand">Tes RDV comparatif et rappels Capella synchronisés avec ton Google Calendar.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-800">● RDV comparatif</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">● Rappel</span>
          </div>
        </div>
        {account ? (
          <form action="/api/calendar/disconnect" method="post">
            <input type="hidden" name="returnTo" value="/agenda" />
            <button className="h-9 rounded-lg border border-navy-200 bg-white px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50">Déconnecter Google Calendar</button>
          </form>
        ) : (
          <a href="/api/calendar/connect?returnTo=%2Fagenda" className="inline-flex h-9 items-center rounded-lg bg-star-500 px-4 text-xs font-semibold text-white hover:bg-star-600">Connecter Google Calendar</a>
        )}
      </div>

      {query.calendar === "connecte" ? <div className="mt-5 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Google Calendar connecté.</div> : null}
      {query.calendar === "deconnecte" ? <div className="mt-5 rounded-lg bg-navy-50 px-4 py-3 text-sm font-medium text-navy-700">Google Calendar déconnecté du CRM.</div> : null}
      {query.calendar === "erreur" ? <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">Connexion impossible : {query.message || "erreur inconnue"}</div> : null}

      <section className="mt-6 rounded-xl border border-navy-100 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-navy-800">Google Calendar</h2>
            {account ? <p className="mt-1 text-sm text-grey-brand">Connecté avec <strong className="text-navy-700">{account.email}</strong></p> : <p className="mt-1 text-sm text-grey-brand">Connecte ton compte Google pour créer des RDV depuis les fiches prospect.</p>}
          </div>
          {account ? <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">● Connecté</span> : <span className="rounded-full bg-grey-100 px-3 py-1 text-xs font-semibold text-grey-brand">Non connecté</span>}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-navy-800">Prochains événements</h2>
          <span className="text-xs text-grey-brand">{events.length} événement{events.length > 1 ? "s" : ""}</span>
        </div>

        {events.length ? (
          <div className="space-y-3">
            {events.map((event) => {
              const prospect = prospectMap.get(event.prospect_id);
              const label = prospect ? (prospect.raison_sociale || nomComplet(prospect.nom, prospect.prenom)) : "Prospect";
              return (
                <article key={event.id} className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${eventClasses(event.kind)}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span aria-hidden>{event.kind === "rappel" ? "⏰" : "📅"}</span>
                      <span className={event.kind === "rappel" ? "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800" : "rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800"}>{event.kind === "rappel" ? "Rappel" : "RDV comparatif"}</span>
                      <h3 className="truncate text-sm font-semibold text-navy-800">{event.title}</h3>
                    </div>
                    <div className="mt-1 text-xs font-bold text-navy-700">{fmtDateHeure(event.start_at)}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-grey-brand">
                      {prospect ? <Link href={`/prospection/${event.prospect_id}`} className="font-medium text-navy-700 underline underline-offset-2">{label}</Link> : <span>{label}</span>}
                      {event.location ? <span>{event.location}</span> : null}
                      {event.invite_client ? <span>Client invité</span> : null}
                    </div>
                  </div>
                  {event.html_link ? <a href={event.html_link} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-navy-700 underline underline-offset-2">Ouvrir dans Google Calendar ↗</a> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-10 text-center">
            <p className="text-sm font-semibold text-navy-700">Aucun événement Capella à venir.</p>
            <p className="mt-1 text-xs text-grey-brand">Ouvre une fiche prospect et utilise le bloc « Rendez-vous & rappels ».</p>
            <Link href="/prospection" className="mt-4 inline-flex h-9 items-center rounded-lg bg-navy-800 px-4 text-xs font-semibold text-white hover:bg-navy-700">Aller à la prospection</Link>
          </div>
        )}
      </section>
    </main>
  );
}
