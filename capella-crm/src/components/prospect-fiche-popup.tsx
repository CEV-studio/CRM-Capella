"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function ProspectFichePopup({ prospectId, prospectLabel, children, className, ariaLabel }: {
  prospectId: string;
  prospectLabel: string;
  children: ReactNode;
  className: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const modal = open ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy-900/65 p-3 backdrop-blur-[2px] md:p-5" role="dialog" aria-modal="true" aria-label={`Fiche prospect — ${prospectLabel}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="flex h-[94vh] w-full max-w-[1700px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-navy-100 bg-white px-5 py-3">
          <h2 className="truncate font-display text-lg font-bold text-navy-900">Fiche prospect — {prospectLabel}</h2>
          <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-navy-200 bg-white text-navy-600 shadow-sm hover:bg-navy-50" aria-label="Fermer"><X size={17}/></button>
        </header>
        <div className="min-h-0 flex-1 bg-navy-50/30"><iframe title={`Fiche prospect — ${prospectLabel}`} src={`/popup/prospect/${prospectId}`} className="h-full w-full border-0 bg-white" /></div>
      </div>
    </div>
  ) : null;

  return <>
    <button type="button" onClick={() => setOpen(true)} className={className} aria-label={ariaLabel}>{children}</button>
    {mounted && modal ? createPortal(modal, document.body) : null}
  </>;
}
