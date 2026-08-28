"use client";

import { useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/domain/database.types";

function localDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fmtEventDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function eventClasses(kind: CalendarEvent["kind"]) {
  return kind === "rappel"
    ? "border-amber-200 bg-amber-50/80"
    : "border-sky-200 bg-sky-50/80";
}

export function CalendarPanel({
  prospectId,
  prospectEmail,
  prospectLabel,
  connected,
  accountEmail,
  events,
}: {
  prospectId: string;
  prospectEmail: string | null;
  prospectLabel: string;
  connected: boolean;
  accountEmail: string | null;
  events: CalendarEvent[];
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"rdv" | "rappel">("rappel");
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState(() => {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
    return localDateTimeInput(date);
  });
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [inviteClient, setInviteClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [localEvents, setLocalEvents] = useState(events);

  const sortedEvents = useMemo(
    () => [...localEvents].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [localEvents],
  );

  async function creer() {
    if (!connected || !startLocal || saving) return;
    setSaving(true);
    setStatus({ ok: true, text: "Création en cours…" });
    try {
      const response = await fetch(`/api/calendar/prospects/${prospectId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          startLocal,
          durationMinutes,
          reminderMinutes,
          description,
          location,
          inviteClient,
        }),
      });

      const raw = await response.text();
      let data: { ok?: boolean; event?: CalendarEvent; error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) as typeof data : {};
      } catch {
        throw new Error(`Réponse calendrier invalide (${response.status}).`);
      }
      if (!response.ok || !data.event) throw new Error(data.error || `Création impossible (${response.status}).`);

      setLocalEvents((current) => [...current, data.event!]);
      setStatus({
        ok: true,
        text: kind === "rappel"
          ? "Rappel ajouté à Google Calendar et à l’agenda CRM."
          : "RDV comparatif ajouté à Google Calendar et à l’agenda CRM.",
      });
      setTitle("");
      setDescription("");
      setLocation("");
      setInviteClient(false);
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : "Création impossible." });
    } finally {
      setSaving(false);
    }
  }

  async function supprimer(event: CalendarEvent) {
    if (!window.confirm(`Supprimer « ${event.title} » de Google Calendar ?`)) return;
    setDeletingId(event.id);
    setStatus(null);
    try {
      const response = await fetch(`/api/calendar/events/${event.id}`, { method: "DELETE" });
      const raw = await response.text();
      const data = raw ? JSON.parse(raw) as { ok?: boolean; error?: string } : {};
      if (!response.ok) throw new Error(data.error || "Suppression impossible.");
      setLocalEvents((current) => current.filter((item) => item.id !== event.id));
      setStatus({ ok: true, text: "Événement supprimé de Google Calendar." });
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : "Suppression impossible." });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {connected ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setStatus(null); }}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
        >
          <span aria-hidden>⏰</span>
          Rappels & RDV
          {sortedEvents.length ? <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px]">{sortedEvents.length}</span> : null}
        </button>
      ) : (
        <a
          href={`/api/calendar/connect?returnTo=${encodeURIComponent(`/prospection/${prospectId}`)}`}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-2 text-xs font-semibold text-navy-700 hover:bg-navy-50"
        >
          <span aria-hidden>📅</span>
          Connecter l’agenda
        </a>
      )}

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/40 p-4" role="dialog" aria-modal="true" aria-label="Rappels et rendez-vous">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-navy-100 bg-white px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-navy-800">Rappels & RDV — {prospectLabel}</h2>
                <p className="mt-1 text-xs text-grey-brand">Google Calendar · {accountEmail}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-navy-50 text-lg text-navy-700 hover:bg-navy-100" aria-label="Fermer">×</button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <div className="mb-4 flex rounded-xl bg-navy-50 p-1">
                  <button type="button" onClick={() => { setKind("rappel"); setTitle(""); }} className={kind === "rappel" ? "flex-1 rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800" : "flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-grey-brand"}>⏰ Rappel</button>
                  <button type="button" onClick={() => { setKind("rdv"); setTitle(""); }} className={kind === "rdv" ? "flex-1 rounded-lg bg-sky-100 px-3 py-2 text-xs font-bold text-sky-800" : "flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-grey-brand"}>📅 RDV comparatif</button>
                </div>

                <div className="grid gap-3">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${kind === "rappel" ? "Rappel" : "Présentation comparatif"} — ${prospectLabel}`} className="h-10 rounded-lg border border-navy-200 px-3 text-sm" />
                  <label className="text-xs font-semibold text-navy-700">{kind === "rdv" ? "Date & heure de la présentation" : "Date & heure du rappel"}
                    <input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-navy-200 px-3 text-sm" />
                  </label>
                  {kind === "rdv" ? (
                    <label className="text-xs font-semibold text-navy-700">Durée
                      <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="mt-1 h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm">
                        <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 h</option><option value={90}>1 h 30</option><option value={120}>2 h</option>
                      </select>
                    </label>
                  ) : null}
                  <label className="text-xs font-semibold text-navy-700">Alerte Google
                    <select value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} className="mt-1 h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm">
                      <option value={0}>Aucune</option><option value={10}>10 min avant</option><option value={30}>30 min avant</option><option value={60}>1 h avant</option><option value={1440}>1 jour avant</option>
                    </select>
                  </label>
                  {kind === "rdv" ? <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lieu / visio (facultatif)" className="h-10 rounded-lg border border-navy-200 px-3 text-sm" /> : null}
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Note…" className="rounded-lg border border-navy-200 px-3 py-2 text-sm leading-5" />
                  {kind === "rdv" && prospectEmail ? (
                    <label className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-navy-700">
                      <input type="checkbox" checked={inviteClient} onChange={(e) => setInviteClient(e.target.checked)} className="mt-0.5" />
                      <span>Inviter le client à <strong>{prospectEmail}</strong>. L’invitation indiquera la date et l’heure de présentation.</span>
                    </label>
                  ) : null}
                  <button type="button" onClick={() => void creer()} disabled={saving || !startLocal} className={kind === "rappel" ? "h-10 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50" : "h-10 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"}>
                    {saving ? "Création…" : kind === "rappel" ? "Créer le rappel" : "Créer le RDV comparatif"}
                  </button>
                  {status ? <p className={`rounded-lg px-3 py-2 text-xs ${status.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{status.text}</p> : null}
                </div>
              </div>

              <div className="border-t border-navy-100 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-navy-800">À venir</h3>
                  <span className="text-[10px] text-grey-brand">{sortedEvents.length} événement{sortedEvents.length > 1 ? "s" : ""}</span>
                </div>
                {sortedEvents.length ? (
                  <div className="space-y-2">
                    {sortedEvents.slice(0, 8).map((event) => (
                      <div key={event.id} className={`rounded-lg border p-3 ${eventClasses(event.kind)}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-navy-800">{event.kind === "rappel" ? "⏰ " : "📅 "}{event.title}</div>
                            <div className="mt-1 text-[11px] font-bold text-navy-700">{fmtEventDate(event.start_at)}</div>
                            {event.location ? <div className="mt-1 truncate text-[11px] text-grey-brand">{event.location}</div> : null}
                          </div>
                          <button type="button" onClick={() => void supprimer(event)} disabled={deletingId === event.id} className="shrink-0 text-xs text-grey-brand hover:text-red-700 disabled:opacity-40" title="Supprimer">×</button>
                        </div>
                        {event.html_link ? <a href={event.html_link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] font-semibold text-navy-700 underline underline-offset-2">Ouvrir dans Google ↗</a> : null}
                      </div>
                    ))}
                  </div>
                ) : <p className="rounded-lg bg-navy-50 px-3 py-6 text-center text-xs text-grey-brand">Aucun rappel ou RDV à venir.</p>}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
