"use client";

import { useMemo, useState } from "react";
import { AlarmClock, CalendarDays, FileText, Mail } from "lucide-react";
import { PiecesJointes } from "@/components/pieces-jointes";
import { ProspectNoteEditor } from "@/components/prospect-note-editor";
import type { CalendarEvent, PieceJointe } from "@/lib/domain/database.types";

type ActivityEmail = {
  id: string;
  direction: "incoming" | "outgoing";
  subject: string | null;
  snippet: string | null;
  sent_at: string | null;
  from_email: string | null;
};

type Filter = "all" | "email" | "calendar" | "file";
type Tab = "activity" | "notes" | "files" | "history";

type TimelineItem = {
  id: string;
  kind: "email" | "calendar" | "file";
  at: string;
  title: string;
  detail: string | null;
  meta: string | null;
  href?: string;
  calendarKind?: "rdv" | "rappel";
};

function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl bg-navy-50 px-5 py-10 text-center">
        <Mail size={22} className="mx-auto text-navy-300" />
        <p className="mt-2 text-sm font-bold text-navy-700">Aucune activité enregistrée</p>
        <p className="mt-1 text-xs text-grey-brand">Les e-mails, rappels, rendez-vous et documents disponibles apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[18px] before:top-4 before:w-px before:bg-navy-100">
      {items.map((item) => {
        const Icon = item.kind === "email" ? Mail : item.kind === "file" ? FileText : item.calendarKind === "rdv" ? CalendarDays : AlarmClock;
        const iconClass = item.kind === "calendar" ? "bg-star-50 text-star-600" : "bg-sky-capella-50 text-sky-capella-700";
        return (
          <article key={`${item.kind}-${item.id}`} className="relative flex gap-3 rounded-xl border border-navy-100 bg-white p-3 transition hover:border-sky-capella-200 hover:bg-sky-capella-50/25">
            <div className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}><Icon size={16} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-navy-400">
                    {item.kind === "email" ? "E-mail" : item.kind === "file" ? "Fichier" : item.calendarKind === "rdv" ? "Rendez-vous" : "Rappel"}
                  </div>
                  {item.href ? <a href={item.href} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-sm font-bold text-navy-900 hover:text-sky-capella-700">{item.title}</a> : <strong className="mt-0.5 block truncate text-sm text-navy-900">{item.title}</strong>}
                </div>
                <time className="shrink-0 text-[10px] font-semibold text-grey-brand" dateTime={item.at}>{formatDateTime(item.at)}</time>
              </div>
              {item.detail ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-navy-500">{item.detail}</p> : null}
              {item.meta ? <p className="mt-1 text-[10px] font-medium text-navy-400">{item.meta}</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ProspectActivity({ prospectId, emails, events, pieces }: {
  prospectId: string;
  emails: ActivityEmail[];
  events: CalendarEvent[];
  pieces: PieceJointe[];
}) {
  const [tab, setTab] = useState<Tab>("activity");
  const [filter, setFilter] = useState<Filter>("all");

  const timeline = useMemo<TimelineItem[]>(() => {
    const emailItems = emails.filter((email) => email.sent_at).map((email) => ({
      id: email.id,
      kind: "email" as const,
      at: email.sent_at!,
      title: email.subject || "Sans objet",
      detail: email.snippet,
      meta: email.direction === "incoming" ? "E-mail reçu" : "E-mail envoyé",
    }));
    const calendarItems = events.map((event) => ({
      id: event.id,
      kind: "calendar" as const,
      at: event.start_at,
      title: event.title,
      detail: event.description,
      meta: event.location,
      href: event.html_link || undefined,
      calendarKind: event.kind,
    }));
    const fileItems = pieces.map((piece) => ({
      id: piece.id,
      kind: "file" as const,
      at: piece.created_at,
      title: piece.file_name,
      detail: piece.type === "ACD" ? "Document ACD" : "Facture ou comparatif",
      meta: null,
      href: `/pieces/${piece.id}`,
    }));
    return [...emailItems, ...calendarItems, ...fileItems].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [emails, events, pieces]);

  const filtered = filter === "all" ? timeline : timeline.filter((item) => item.kind === filter);
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "activity", label: "Activité & échanges" },
    { key: "notes", label: "Notes" },
    { key: "files", label: "Fichiers" },
    { key: "history", label: "Historique" },
  ];
  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "Tous" },
    { key: "email", label: "E-mails" },
    { key: "calendar", label: "Rappels & RDV" },
    { key: "file", label: "Fichiers" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-[var(--crm-shadow-sm)]">
      <div className="flex gap-6 overflow-x-auto border-b border-navy-100 px-5 pt-1">
        {tabs.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`relative whitespace-nowrap px-1 py-3.5 text-sm font-semibold ${tab === item.key ? "text-navy-900" : "text-navy-500 hover:text-navy-800"}`}>{item.label}{tab === item.key ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-star-500" /> : null}</button>)}
      </div>

      {tab === "activity" ? (
        <div className="p-4 sm:p-5">
          <ProspectNoteEditor prospectId={prospectId} compact />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {filters.map((item) => <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === item.key ? "border-sky-capella-200 bg-sky-capella-50 text-sky-capella-700" : "border-navy-100 bg-white text-navy-500 hover:bg-navy-50"}`}>{item.label}</button>)}
          </div>
          <div className="mt-4"><Timeline items={filtered} /></div>
        </div>
      ) : null}

      {tab === "notes" ? <div className="p-4 sm:p-5"><ProspectNoteEditor prospectId={prospectId} /></div> : null}
      {tab === "files" ? <div className="p-4 sm:p-5"><PiecesJointes scope="prospect" parentId={prospectId} pieces={pieces} /></div> : null}
      {tab === "history" ? <div className="p-4 sm:p-5"><Timeline items={timeline} /></div> : null}
    </section>
  );
}
