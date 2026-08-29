"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, FileText, Mail, X } from "lucide-react";

type Tool = "email" | "comparatif" | "resiliation" | null;

const CONFIG = {
  email: { label: "E-mail", Icon: Mail, title: "E-mail", className: "border-sky-capella-600 bg-sky-capella-600 text-white hover:border-sky-capella-700 hover:bg-sky-capella-700" },
  comparatif: { label: "Comparatif", Icon: BarChart3, title: "Comparatif", className: "border-sky-capella-600 bg-sky-capella-600 text-white hover:border-sky-capella-700 hover:bg-sky-capella-700" },
  resiliation: { label: "Résiliation", Icon: FileText, title: "Résiliation", className: "border-star-500 bg-star-500 text-white hover:border-star-600 hover:bg-star-600" },
} as const;

export function ProspectToolsModal({ prospectId, prospectLabel }: { prospectId: string; prospectLabel: string }) {
  const [tool, setTool] = useState<Tool>(null);
  const [mounted, setMounted] = useState(false);
  const active = tool ? CONFIG[tool] : null;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!tool) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [tool]);
  useEffect(() => {
    if (!tool) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setTool(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tool]);

  const modal = tool && active ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy-900/65 p-3 backdrop-blur-[2px] md:p-5" role="dialog" aria-modal="true" aria-label={`${active.title} — ${prospectLabel}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setTool(null); }}>
      <div className="flex h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-navy-100 bg-white px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-capella-50 text-sky-capella-700"><active.Icon size={16}/></span><h2 className="truncate font-display text-lg font-bold text-navy-900">{active.title} — {prospectLabel}</h2></div>
            <p className="mt-1 text-[11px] text-grey-brand">Chargé uniquement à l’ouverture de cette fenêtre.</p>
          </div>
          <button type="button" onClick={() => setTool(null)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-navy-200 bg-white text-navy-600 shadow-sm hover:bg-navy-50 hover:text-navy-900" aria-label="Fermer"><X size={17}/></button>
        </header>
        <div className="min-h-0 flex-1 bg-navy-50/30"><iframe key={tool} title={`${active.title} — ${prospectLabel}`} src={`/popup/${tool}/${prospectId}`} className="h-full w-full border-0 bg-white" /></div>
      </div>
    </div>
  ) : null;

  return <>
    <div className="contents">
      {(Object.keys(CONFIG) as Array<Exclude<Tool, null>>).map((key) => {
        const item = CONFIG[key];
        return <button key={key} type="button" onClick={() => setTool(key)} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold shadow-sm transition ${item.className}`}>
          <item.Icon size={16} strokeWidth={2}/>{item.label}
        </button>;
      })}
    </div>
    {mounted && modal ? createPortal(modal, document.body) : null}
  </>;
}
