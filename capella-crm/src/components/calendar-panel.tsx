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
  const [kind, setKind] = useState<"rdv" | "rappel">("rdv");
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

      if (!response.ok || !data.event) {
        throw new Error(data.error || `Création impossible (${response.status}).`);
      }

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
      setOpen(false);
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
    <section className="rounded-xl border border-navy-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden>📅</span>
            <h2 className="text-sm font-semibold text-navy-800">Rendez-vous & rappels</h2>
          </div>
          {connected ? (
            <p className="mt-1 truncate text-[11px] text-grey-brand" title={accountEmail || undefined}>Google Calendar · {accountEmail}</p>
          ) : (
            <p className="mt-1 text-[11px] text-grey-brand">Aucun agenda connecté.</p>
          )}
        </div>
        {connected ? (
          <button type="button" onClick={() => setOpen((value) => !value)} className="shrink-0 rounded-lg bg-star-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-star-600">
            {open ? "Fermer" : "+ Ajouter"}
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-800">● RDV comparatif</span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">● Rappel</span>
      </div>

      {!connected ? (
        <a href={`/api/calendar/connect?returnTo=${encodeURIComponent(`/prospection/${prospectId}`)}`} className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-navy-800 px-3 text-xs font-semibold text-white hover:bg-navy-700">
          Connecter Google Calendar
        </a>
      ) : null}

      {open && connected ? (
        <div className="mt-4 grid gap-2 border-t border-navy-100 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <select value={kind} onChange={(e) => { setKind(e.target.value as "rdv" | "rappel"); setTitle(""); }} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-xs">
              <option value="rdv">RDV comparatif</option>
              <option value="rappel">Rappel</option>
            </select>
            <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-xs">
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 h</option>
              <option value={90}>1 h 30</option>
              <option value={120}>2 h</option>
            </select>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${kind === "rappel" ? "Rappel" : "Présentation comparatif"} — ${prospectLabel}`} className="h-9 rounded-lg border border-navy-200 px-3 text-xs" />
          <label className="text-[11px] font-semibold text-navy-700">Date & heure de la présentation
            <input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-navy-200 px-2 text-xs" />
          </label>
          <select value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-xs">
            <option value={0}>Aucun rappel Google</option>
            <option value={10}>Rappel 10 min avant</option>
            <option value={30}>Rappel 30 min avant</option>
            <option value={60}>Rappel 1 h avant</option>
            <option value={1440}>Rappel 1 jour avant</option>
          </select>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lieu / visio (facultatif)" className="h-9 rounded-lg border border-navy-200 px-3 text-xs" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Note pour le rendez-vous…" className="rounded-lg border border-navy-200 px-3 py-2 text-xs leading-5" />
          {prospectEmail ? (
            <label className="flex items-start gap-2 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-700">
              <input type="checkbox" checked={inviteClient} onChange={(e) => setInviteClient(e.target.checked)} className="mt-0.5" />
              <span>Inviter le client à <strong>{prospectEmail}</strong>. L’invitation indiquera la date et l’heure de présentation.</span>
            </label>
          ) : null}
          <button type="button" onClick={() => void creer()} disabled={saving || !startLocal} className="h-9 rounded-lg bg-star-500 px-3 text-xs font-semibold text-white hover:bg-star-600 disabled:opacity-50">
            {saving ? "Création…" : kind === "rappel" ? "Créer le rappel" : "Envoyer le RDV comparatif"}
          </button>
          {status ? <p className={`rounded-lg px-3 py-2 text-xs ${status.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{status.text}</p> : null}
        </div>
      ) : null}

      {sortedEvents.length ? (
        <div className="mt-4 space-y-2 border-t border-navy-100 pt-3">
          {sortedEvents.slice(0, 6).map((event) => (
            <div key={event.id} className={`rounded-lg border p-2.5 ${eventClasses(event.kind)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-navy-800">{event.kind === "rappel" ? "⏰ Rappel — " : "📅 RDV comparatif — "}{event.title}</div>
                  <div className="mt-0.5 text-[11px] font-bold text-navy-700">{fmtEventDate(event.start_at)}</div>
                  {event.location ? <div className="mt-0.5 truncate text-[11px] text-grey-brand">{event.location}</div> : null}
                </div>
                <button type="button" onClick={() => void supprimer(event)} disabled={deletingId === event.id || !connected} className="shrink-0 text-xs text-grey-brand hover:text-red-700 disabled:opacity-40" title="Supprimer">×</button>
              </div>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-grey-brand">
                {event.html_link ? <a href={event.html_link} target="_blank" rel="noreferrer" className="font-semibold text-navy-700 underline underline-offset-2">Ouvrir dans Google</a> : null}
                {event.invite_client ? <span>Client invité</span> : null}
              </div>
            </div>
          ))}
        </div>
      ) : connected ? <p className="mt-3 text-xs text-grey-brand">Aucun rendez-vous lié à cette fiche.</p> : null}

      {!open && status ? <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${status.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{status.text}</p> : null}
    </section>
  );
}
