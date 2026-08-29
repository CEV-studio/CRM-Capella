"use client";

import { useEffect, useRef, useState } from "react";

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
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ProspectNoteEditor({ prospectId }: { prospectId: string; initialNotes?: string | null; compact?: boolean }) {
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
    el.style.height = "40px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 40), 150)}px`;
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
        if (textareaRef.current) textareaRef.current.style.height = "40px";
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
      if (editingId === noteId) {
        setEditingId(null);
        setEditingBody("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusyNoteId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-navy-200 bg-white shadow-sm">
      <div className="border-b border-navy-100 bg-navy-50 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-star-500" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-navy-700">Notes commerciales</span>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={body}
            onChange={(e) => { setBody(e.target.value); resize(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ajouter();
              }
            }}
            placeholder="Ajouter une note…"
            className="min-h-10 flex-1 resize-none overflow-y-auto rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm leading-5 text-navy-800 outline-none transition focus:border-star-500 focus:ring-2 focus:ring-star-500/15"
          />
          <button
            type="button"
            onClick={() => void ajouter()}
            disabled={saving || !body.trim()}
            className="inline-flex h-10 shrink-0 items-center rounded-lg bg-star-500 px-4 text-xs font-bold text-white transition hover:bg-star-600 disabled:opacity-40"
          >
            {saving ? "Ajout…" : "Ajouter"}
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[10px] text-grey-brand">
          <span>Entrée pour ajouter · Maj+Entrée pour aller à la ligne</span>
          {notes.length ? <span className="font-semibold text-navy-500">{notes.length} note{notes.length > 1 ? "s" : ""}</span> : null}
        </div>
        {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
      </div>

      {loading ? (
        <div className="px-4 py-5 text-xs text-grey-brand">Chargement des notes…</div>
      ) : notes.length ? (
        <div className="divide-y divide-navy-100">
          {notes.map((note) => (
            <article key={note.id} className="border-l-2 border-l-transparent px-4 py-3 transition hover:border-l-star-400 hover:bg-star-50/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-navy-800 px-2 py-0.5 text-[10px] font-bold text-white">{note.author_name}</span>
                  <time className="text-[10px] text-grey-brand" dateTime={note.created_at}>{fmtNoteDate(note.created_at)}</time>
                  {note.updated_at ? <span className="text-[10px] italic text-star-600">modifiée {fmtNoteDate(note.updated_at)}</span> : null}
                </div>
                {note.can_edit ? (
                  <div className="flex items-center gap-2 text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditingBody(note.body);
                        setError(null);
                      }}
                      className="text-navy-600 hover:text-star-600"
                    >Modifier</button>
                    <button
                      type="button"
                      onClick={() => void supprimer(note.id)}
                      disabled={busyNoteId === note.id}
                      className="text-red-600 hover:text-red-800 disabled:opacity-40"
                    >Supprimer</button>
                  </div>
                ) : null}
              </div>

              {editingId === note.id ? (
                <div className="mt-2">
                  <textarea
                    rows={3}
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    className="w-full resize-y rounded-lg border border-star-300 bg-white px-3 py-2 text-sm leading-5 text-navy-800 outline-none focus:ring-2 focus:ring-star-500/15"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void modifier(note.id)}
                      disabled={busyNoteId === note.id || !editingBody.trim()}
                      className="inline-flex h-8 items-center rounded-lg bg-star-500 px-3 text-xs font-bold text-white hover:bg-star-600 disabled:opacity-40"
                    >{busyNoteId === note.id ? "Enregistrement…" : "Enregistrer"}</button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(null); setEditingBody(""); }}
                      className="inline-flex h-8 items-center rounded-lg border border-navy-200 bg-white px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50"
                    >Annuler</button>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-navy-800">{note.body}</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="px-4 py-4 text-xs text-grey-brand">Aucune note pour le moment.</div>
      )}
    </section>
  );
}
