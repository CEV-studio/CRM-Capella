"use client";

import { useActionState } from "react";
import { changerEtape } from "@/app/(app)/prospection/actions";
import { MenuEtape } from "@/components/menu-etape";
import { PROSPECT_STAGES, stageColor } from "@/lib/domain/stages";
import type { ActionResult } from "@/lib/action-result";

export function ProspectStageEditor({ prospectId, stage }: { prospectId: string; stage: string }) {
  const [result, action] = useActionState<ActionResult | null, FormData>(changerEtape, null);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <MenuEtape
        id={prospectId}
        etapeEnBase={stage}
        etapes={PROSPECT_STAGES}
        couleur={(value) => stageColor(value, "prospect")}
        action={action}
        resultat={result}
        libelle="Modifier l’étape du prospect"
        className="shadow-sm ring-1 ring-navy-900/5"
      />
      {result && !result.ok ? <span className="max-w-64 text-[10px] font-medium text-red-600">{result.message}</span> : null}
    </div>
  );
}
