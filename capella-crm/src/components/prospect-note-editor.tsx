"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

type ProspectNote = {
  id: string;
  body: string;
  author_name: string;
  created_at: string;
  updated_at?: string | null;
  can_edit?: boolean;
};

function fmtNoteDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ProspectNoteEditor({ prospectId, compact = false }: { prospectId: string; initialNotes?: string | null; compact?: boolean }) {
  const [notes, setNotes] = useState<ProspectNote[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/prospects/${prospectId}/notes`, { cache: "no-store" });
        const data = await response.json() as { notes?: ProspectNote[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Chargement des notes impossible.");
        if (!cancelled) setNotes(data.notes ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Chargement des notes impossible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [prospectId]);

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "42px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 42), 140)}px`;
  }

  async function ajouter() {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/prospects/${prospectId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await response.json() as { note?: ProspectNote; error?: string };
      if (!response.ok || !data.note) throw new Error(data.error || "Ajout de la note impossible.");
      setNotes((current) => [data.note!, ...current]);
      setBody("");
      requestAnimationFrame(() => {
        if (textareaRef.current) textareaRef.current.style.height = "42px";
        textareaRef.current?.focus();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ajout de la note impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function modifier(noteId: string) {
    const text = editingBody.trim();
    if (!text || busyNoteId) return;
    setBusyNoteId(noteId);
    setError(null);
    try {
      const response = await fetch(`/api/prospects/${prospectId}/notes`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteId, body: text }),
      });
      const data = await response.json() as { note?: ProspectNote; error?: string };
      if (!response.ok || !data.note) throw new Error(data.error || "Modification impossible.");
      setNotes((current) => current.map((note) => note.id === noteId ? data.note! : note));
      setEditingId(null);
      setEditingBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setBusyNoteId(null);
    }
  }

  async function supprimer(noteId: string) {
    if (busyNoteId || !window.confirm("Supprimer cette note ?")) return;
    setBusyNoteId(noteId);
    setError(null);
    try {
      const response = await fetch(`/api/prospects/${prospectId}/notes`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Suppression impossible.");
      setNotes((current) => current.filter((note) => note.id !== noteId));
      if (editingId === noteId) { setEditingId(null); setEditingBody(""); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusyNoteId(null);
    }
  }

  const composer = (
    <>
      <div className="flex items-end gap-2 rounded-xl border border-navy-200 bg-white p-2 shadow-sm transition focus-within:border-sky-capella-300 focus-within:ring-2 focus-within:ring-sky-capella-100">
        <textarea
          ref={textareaRef}
          rows={1}
          value={body}
          onChange={(e) => { setBody(e.target.value); resize(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ajouter(); } }}
          placeholder="Ajouter une note…"
          className="min-h-[42px] flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-sm leading-5 text-navy-900 outline-none placeholder:text-navy-300"
        />
        <button type="button" onClick={() => void ajouter()} disabled={saving || !body.trim()} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-star-500 px-3 text-xs font-bold text-white shadow-sm hover:bg-star-600 disabled:bg-navy-100 disabled:text-navy-300 disabled:shadow-none">
          <Plus size={14}/>{saving ? "Ajout…" : "Ajouter"}
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[10px] text-grey-brand">
        <span>Entrée pour ajouter · Maj+Entrée pour aller à la ligne</span>
        {!compact && notes.length ? <span className="font-semibold text-navy-500">{notes.length} note{notes.length > 1 ? "s" : ""}</span> : null}
      </div>
      {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
    </>
  );

  if (compact) return <div>{composer}</div>;

  return (
    <div>
      {composer}
      {loading ? (
        <div className="mt-3 rounded-xl bg-navy-50 px-4 py-4 text-xs text-grey-brand">Chargement des notes…</div>
      ) : notes.length ? (
        <div className="relative mt-4 space-y-3 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-navy-100">
          {notes.map((note) => (
            <article key={note.id} className="relative flex gap-3">
              <div className="relative z-10 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-star-100 bg-star-50 text-[11px] font-bold text-star-700">{note.author_name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1 rounded-xl border border-navy-100 bg-white p-3 shadow-sm transition hover:border-sky-capella-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><div className="text-xs font-bold text-navy-900">{note.author_name}</div><div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-grey-brand"><time dateTime={note.created_at}>{fmtNoteDate(note.created_at)}</time>{note.updated_at ? <span className="italic text-star-600">modifiée {fmtNoteDate(note.updated_at)}</span> : null}</div></div>
                  {note.can_edit ? <div className="flex items-center gap-1"><button type="button" onClick={() => { setEditingId(note.id); setEditingBody(note.body); setError(null); }} className="rounded-md p-1.5 text-navy-400 hover:bg-sky-capella-50 hover:text-sky-capella-700" aria-label="Modifier la note"><Pencil size={13}/></button><button type="button" onClick={() => void supprimer(note.id)} disabled={busyNoteId === note.id} className="rounded-md p-1.5 text-navy-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40" aria-label="Supprimer la note"><Trash2 size={13}/></button></div> : null}
                </div>
                {editingId === note.id ? <div className="mt-2"><textarea rows={3} value={editingBody} onChange={(e) => setEditingBody(e.target.value)} className="w-full resize-y rounded-lg border border-sky-capella-300 bg-white px-3 py-2 text-sm leading-5 text-navy-800 outline-none focus:ring-2 focus:ring-sky-capella-100"/><div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => void modifier(note.id)} disabled={busyNoteId === note.id || !editingBody.trim()} className="inline-flex h-8 items-center gap-1 rounded-lg bg-navy-900 px-3 text-xs font-bold text-white hover:bg-navy-700 disabled:opacity-40"><Check size={13}/>{busyNoteId === note.id ? "Enregistrement…" : "Enregistrer"}</button><button type="button" onClick={() => { setEditingId(null); setEditingBody(""); }} className="inline-flex h-8 items-center gap-1 rounded-lg border border-navy-200 bg-white px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50"><X size={13}/>Annuler</button></div></div> : <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-navy-800">{note.body}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : <div className="mt-3 rounded-xl bg-navy-50 px-4 py-5 text-center text-xs text-grey-brand">Aucune note pour le moment.</div>}
    </div>
  );
}
