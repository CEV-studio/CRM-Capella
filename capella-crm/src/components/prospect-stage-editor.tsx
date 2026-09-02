"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { PROSPECTION_STAGES, stageColor } from "@/lib/domain/stages";

export function ProspectStageEditor({ prospectId, stage }: { prospectId: string; stage: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(stage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [koReason, setKoReason] = useState("");

  async function selectStage(next: string) {
    if (next === "Demande ACD") {
      window.dispatchEvent(new CustomEvent("open-acd-request"));
      return;
    }
    let reason = "";
    if (next === "KO") {
      reason = window.prompt("Pourquoi ce dossier est-il KO ?", koReason)?.trim() ?? "";
      if (!reason) return;
      setKoReason(reason);
    } else {
      setKoReason("");
    }
    const previous=draft;
    setDraft(next);
    setSaving(true);setError(null);
    const response=await fetch(`/api/prospects/${prospectId}/stage`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body:JSON.stringify({ stage: next, koReason: reason }),
    }).catch(()=>null);
    const data=await response?.json().catch(()=>({})) as {error?:string}|undefined;
    if(!response?.ok){setDraft(previous);setError(data?.error||"Enregistrement impossible.");setSaving(false);return;}
    setSaving(false);router.refresh();
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <label className="relative inline-flex h-8 items-center rounded-full pl-3 pr-8 shadow-sm ring-1 ring-navy-900/5" style={{ backgroundColor: stageColor(draft, "prospect") }}>
        <span className="text-xs font-semibold whitespace-nowrap text-navy-800">{draft}</span>
        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-navy-700/60" />
        <select
          value={draft}
          onChange={(event) => selectStage(event.currentTarget.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Modifier l’étape du prospect"
        >
          {PROSPECTION_STAGES.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
        </select>
      </label>
      {saving ? <span className="text-[9px] font-medium text-star-600">Enregistrement…</span> : <span className="text-[9px] font-medium text-green-700">Enregistré automatiquement</span>}
      {error ? <span className="max-w-72 text-[9px] font-medium text-red-600">{error}</span> : null}
      {draft === "KO" && koReason ? <span className="max-w-52 truncate text-[9px] text-navy-400" title={koReason}>{koReason}</span> : null}
    </div>
  );
}
