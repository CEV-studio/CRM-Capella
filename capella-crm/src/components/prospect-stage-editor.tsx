"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { PROSPECTION_STAGES, stageColor } from "@/lib/domain/stages";

export function ProspectStageEditor({ prospectId, stage }: { prospectId: string; stage: string }) {
  const pathname = usePathname();
  const [draft, setDraft] = useState(stage);
  const [dirty, setDirty] = useState(false);
  const [koReason, setKoReason] = useState("");
  const draftRef = useRef(stage);
  const dirtyRef = useRef(false);
  const koReasonRef = useRef("");

  function selectStage(next: string) {
    if (next === "KO") {
      const reason = window.prompt("Pourquoi ce dossier est-il KO ?", koReasonRef.current)?.trim();
      if (!reason) return;
      koReasonRef.current = reason;
      setKoReason(reason);
    } else {
      koReasonRef.current = "";
      setKoReason("");
    }
    draftRef.current = next;
    dirtyRef.current = next !== stage;
    setDraft(next);
    setDirty(next !== stage);
  }

  function flush() {
    if (!dirtyRef.current) return;
    const body = JSON.stringify({ stage: draftRef.current, koReason: koReasonRef.current });
    dirtyRef.current = false;
    void fetch(`/api/prospects/${prospectId}/stage`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }

  useEffect(() => {
    const initialPath = pathname;
    const onPageHide = () => flush();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      if (window.location.pathname !== initialPath) flush();
    };
  }, [prospectId, pathname]);

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
      {dirty ? <span className="text-[9px] font-medium text-star-600">Sera enregistré en quittant la fiche</span> : null}
      {draft === "KO" && koReason ? <span className="max-w-52 truncate text-[9px] text-navy-400" title={koReason}>{koReason}</span> : null}
    </div>
  );
}
