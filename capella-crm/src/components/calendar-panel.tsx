"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlarmClock, CalendarDays, ExternalLink, Trash2, X } from "lucide-react";
import type { CalendarEvent } from "@/lib/domain/database.types";

function localDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fmtEventDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
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
  return kind === "rappel" ? "border-star-200 bg-star-50/80" : "border-sky-capella-200 bg-sky-capella-50/80";
}

export function CalendarPanel({ prospectId, prospectEmail, prospectLabel, connected, accountEmail, events }: {
  prospectId: string;
  prospectEmail: string | null;
  prospectLabel: string;
  connected: boolean;
  accountEmail: string | null;
  events: CalendarEvent[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => setMounted(true), []);
  useEffect(() => setLocalEvents(events), [events]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const sortedEvents = useMemo(() => [...localEvents].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()), [localEvents]);

  async function creer() {
    if (!connected || !startLocal || saving) return;
    setSaving(true);
    setStatus({ ok: true, text: "Création en cours…" });
    try {
      const response = await fetch(`/api/calendar/prospects/${prospectId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, title, startLocal, durationMinutes, reminderMinutes, description, location, inviteClient }),
      });
      const raw = await response.text();
      let data: { ok?: boolean; event?: CalendarEvent; error?: string } = {};
      try { data = raw ? JSON.parse(raw) as typeof data : {}; } catch { throw new Error(`Réponse calendrier invalide (${response.status}).`); }
      if (!response.ok || !data.event) throw new Error(data.error || `Création impossible (${response.status}).`);
      setLocalEvents((current) => [...current, data.event!]);
      setStatus({ ok: true, text: kind === "rappel" ? "Rappel ajouté à Google Calendar et à l’agenda CRM." : "RDV comparatif ajouté à Google Calendar et à l’agenda CRM." });
      setTitle(""); setDescription(""); setLocation(""); setInviteClient(false);
      router.refresh();
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : "Création impossible." });
    } finally { setSaving(false); }
  }

  async function supprimer(event: CalendarEvent) {
    if (!window.confirm(`Supprimer « ${event.title} » de Google Calendar ?`)) return;
    setDeletingId(event.id); setStatus(null);
    try {
      const response = await fetch(`/api/calendar/events/${event.id}`, { method: "DELETE" });
      const raw = await response.text();
      const data = raw ? JSON.parse(raw) as { ok?: boolean; error?: string } : {};
      if (!response.ok) throw new Error(data.error || "Suppression impossible.");
      setLocalEvents((current) => current.filter((item) => item.id !== event.id));
      setStatus({ ok: true, text: "Événement supprimé de Google Calendar." });
      router.refresh();
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : "Suppression impossible." });
    } finally { setDeletingId(null); }
  }

  const modal = open ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy-900/65 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Rappels et rendez-vous" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/20 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-navy-100 bg-gradient-to-r from-navy-50 via-white to-star-50/50 px-5 py-4">
          <div><h2 className="font-display text-lg font-bold text-navy-800">Rappels & RDV — {prospectLabel}</h2><p className="mt-1 text-xs text-grey-brand">Google Calendar · {accountEmail}</p></div>
          <button type="button" onClick={() => setOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-navy-200 bg-white text-navy-600 shadow-sm hover:bg-navy-50 hover:text-navy-900" aria-label="Fermer"><X size={16}/></button>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-4 flex rounded-xl bg-navy-50 p-1">
              <button type="button" onClick={() => { setKind("rappel"); setTitle(""); }} className={kind === "rappel" ? "flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-star-100 px-3 py-2 text-xs font-bold text-star-800 shadow-sm" : "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-grey-brand hover:text-navy-700"}><AlarmClock size={14}/> Rappel</button>
              <button type="button" onClick={() => { setKind("rdv"); setTitle(""); }} className={kind === "rdv" ? "flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-capella-100 px-3 py-2 text-xs font-bold text-sky-capella-700 shadow-sm" : "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-grey-brand hover:text-navy-700"}><CalendarDays size={14}/> RDV comparatif</button>
            </div>
            <div className="grid gap-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${kind === "rappel" ? "Rappel" : "Présentation comparatif"} — ${prospectLabel}`} className="h-10 rounded-xl border border-navy-200 px-3 text-sm" />
              <label className="text-xs font-semibold text-navy-700">{kind === "rdv" ? "Date & heure de la présentation" : "Date & heure du rappel"}<input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-navy-200 px-3 text-sm" /></label>
              {kind === "rdv" ? <label className="text-xs font-semibold text-navy-700">Durée<select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-navy-200 bg-white px-3 text-sm"><option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 h</option><option value={90}>1 h 30</option><option value={120}>2 h</option></select></label> : null}
              <label className="text-xs font-semibold text-navy-700">Alerte Google<select value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-navy-200 bg-white px-3 text-sm"><option value={0}>Aucune</option><option value={10}>10 min avant</option><option value={30}>30 min avant</option><option value={60}>1 h avant</option><option value={1440}>1 jour avant</option></select></label>
              {kind === "rdv" ? <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lieu / visio (facultatif)" className="h-10 rounded-xl border border-navy-200 px-3 text-sm" /> : null}
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Note…" className="rounded-xl border border-navy-200 px-3 py-2 text-sm leading-5" />
              {kind === "rdv" && prospectEmail ? <label className="flex items-start gap-2 rounded-xl border border-sky-capella-100 bg-sky-capella-50 px-3 py-2 text-xs text-navy-700"><input type="checkbox" checked={inviteClient} onChange={(e) => setInviteClient(e.target.checked)} className="mt-0.5" /><span>Inviter le client à <strong>{prospectEmail}</strong>. L’invitation indiquera la date et l’heure de présentation.</span></label> : null}
              <button type="button" onClick={() => void creer()} disabled={saving || !startLocal} className={kind === "rappel" ? "h-10 rounded-xl bg-star-500 px-4 text-sm font-semibold text-white shadow-[0_5px_14px_rgba(232,96,48,.20)] hover:bg-star-600 disabled:opacity-50" : "h-10 rounded-xl bg-navy-800 px-4 text-sm font-semibold text-white shadow-sm hover:bg-navy-700 disabled:opacity-50"}>{saving ? "Création…" : kind === "rappel" ? "Créer le rappel" : "Créer le RDV comparatif"}</button>
              {status ? <p className={`rounded-lg px-3 py-2 text-xs ${status.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{status.text}</p> : null}
            </div>
          </div>
          <div className="border-t border-navy-100 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-navy-800">À venir</h3><span className="text-[10px] text-grey-brand">{sortedEvents.length} événement{sortedEvents.length > 1 ? "s" : ""}</span></div>
            {sortedEvents.length ? <div className="space-y-2">{sortedEvents.slice(0, 8).map((event) => {
              const EventIcon = event.kind === "rappel" ? AlarmClock : CalendarDays;
              return <div key={event.id} className={`rounded-xl border p-3 shadow-sm ${eventClasses(event.kind)}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex items-center gap-1.5 truncate text-xs font-semibold text-navy-800"><EventIcon size={13} className={event.kind === "rappel" ? "text-star-600" : "text-sky-capella-700"}/><span className="truncate">{event.title}</span></div><div className="mt-1 text-[11px] font-bold text-navy-700">{fmtEventDate(event.start_at)}</div>{event.location ? <div className="mt-1 truncate text-[11px] text-grey-brand">{event.location}</div> : null}</div><button type="button" onClick={() => void supprimer(event)} disabled={deletingId === event.id} className="shrink-0 rounded-lg p-1 text-grey-brand hover:bg-red-50 hover:text-red-700 disabled:opacity-40" title="Supprimer" aria-label="Supprimer"><Trash2 size={13}/></button></div>{event.html_link ? <a href={event.html_link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-navy-700 hover:text-star-600">Ouvrir dans Google <ExternalLink size={11}/></a> : null}</div>;
            })}</div> : <p className="rounded-lg bg-navy-50 px-3 py-6 text-center text-xs text-grey-brand">Aucun rappel ou RDV à venir.</p>}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return <>
    {connected ? <button type="button" onClick={() => { setOpen(true); setStatus(null); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-navy-200 bg-white px-4 text-sm font-bold text-navy-700 shadow-sm transition hover:border-star-300 hover:bg-star-50 hover:text-star-700"><AlarmClock size={16}/>Rappels & RDV{sortedEvents.length ? <span className="rounded-full bg-star-500 px-1.5 py-0.5 text-[10px] text-white">{sortedEvents.length}</span> : null}</button> : <a href={`/api/calendar/connect?returnTo=${encodeURIComponent(`/prospection/${prospectId}`)}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-navy-200 bg-white px-4 text-sm font-bold text-navy-700 shadow-sm transition hover:border-sky-capella-300 hover:bg-sky-capella-50"><CalendarDays size={16}/>Connecter l’agenda</a>}
    {mounted && modal ? createPortal(modal, document.body) : null}
  </>;
}
