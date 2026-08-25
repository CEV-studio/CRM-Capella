"use client";

import { useActionState } from "react";
import { enregistrerNotes } from "@/app/(app)/prospection/actions";
import type { ActionResult } from "@/lib/action-result";

export function ProspectNoteEditor({
  prospectId,
  initialNotes,
  compact = false,
}: {
  prospectId: string;
  initialNotes: string | null;
  compact?: boolean;
}) {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(enregistrerNotes, null);

  return (
    <form action={action} className={compact ? "grid gap-2" : "rounded-xl border border-navy-100 bg-white p-4"}>
      <input type="hidden" name="id" value={prospectId} />
      {!compact ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-grey-brand">Note</div>
            <div className="text-xs text-grey-brand">Mémo commercial toujours accessible</div>
          </div>
          {etat?.ok ? <span className="text-[11px] font-medium text-green-700">Enregistrée</span> : null}
        </div>
      ) : null}
      <textarea
        name="notes"
        rows={compact ? 4 : 6}
        defaultValue={initialNotes ?? ""}
        placeholder="Ajouter une note…"
        className="w-full resize-y rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm leading-5 text-navy-800 focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/20"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex h-8 items-center rounded-lg bg-navy-800 px-3 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : "Enregistrer la note"}
        </button>
        {etat && !etat.ok ? <span className="text-xs text-red-700">{etat.message}</span> : null}
        {compact && etat?.ok ? <span className="text-xs text-green-700">{etat.message}</span> : null}
      </div>
    </form>
  );
}
