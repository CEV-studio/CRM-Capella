"use client";

import { useActionState } from "react";
import { convertirProspect } from "@/app/(app)/conversion/actions";
import type { ActionResult } from "@/lib/action-result";

export function TransferProspectForm({ prospectId }: { prospectId: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(convertirProspect, null);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-sky-capella-200 bg-sky-capella-50 p-5">
      <input type="hidden" name="prospect_id" value={prospectId} />
      <p className="text-sm text-navy-800">Les informations du prospect seront reprises dans une demande de cotation. Tu pourras ensuite compléter le contrat et les pièces depuis sa fiche.</p>
      {result && !result.ok ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{result.message}</p> : null}
      <button disabled={pending} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Transmission…" : "Transmettre à l’ADV"}
      </button>
    </form>
  );
}
