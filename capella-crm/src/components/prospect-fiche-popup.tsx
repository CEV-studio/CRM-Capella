"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function ProspectFichePopup({ prospectId, prospectLabel, children, className, ariaLabel, navigation }: {
  prospectId: string;
  prospectLabel: string;
  children: ReactNode;
  className: string;
  ariaLabel?: string;
  navigation?: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState(prospectId);
  const iframe = useRef<HTMLIFrameElement>(null);
  const index = navigation?.findIndex((item) => item.id === currentId) ?? -1;
  const currentLabel = navigation?.[index]?.label ?? prospectLabel;
  function canLeave() {
    const dirty = iframe.current?.contentDocument?.querySelector("[data-unsaved-note=true]");
    return !dirty || window.confirm("Une note n’a pas été enregistrée. Quitter cette fiche ?");
  }
  function close() { if (canLeave()) setOpen(false); }
  function move(offset: number) {
    const target = navigation?.[index + offset];
    if (target && canLeave()) setCurrentId(target.id);
  }
  const closeButton = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && canLeave()) setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      previousFocus?.focus();
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const modal = open ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy-900/40 p-0 backdrop-blur-[2px] sm:p-4" role="dialog" aria-modal="true" aria-label={`Fiche prospect — ${currentLabel}`} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="crm-modal-panel flex h-[100dvh] w-full max-w-[1500px] flex-col overflow-hidden rounded-none sm:h-[94dvh] sm:rounded-2xl border border-white/20 bg-white shadow-2xl">
        <header className="crm-modal-header flex shrink-0 items-center justify-between border-b border-navy-100 bg-white px-4 py-3 sm:px-6">
          <h2 className="min-w-0 truncate font-display text-base font-semibold text-navy-900">Fiche prospect — {currentLabel}</h2>
          <div className="flex shrink-0 items-center gap-2">{index >= 0 && navigation && navigation.length > 1 ? <><button type="button" onClick={() => move(-1)} disabled={index === 0} className="rounded-lg border border-navy-200 p-2 text-navy-700 hover:bg-navy-50 disabled:opacity-30" aria-label="Fiche précédente"><ChevronLeft size={17}/></button><span className="text-xs tabular text-navy-500">{index + 1} / {navigation.length}</span><button type="button" onClick={() => move(1)} disabled={index === navigation.length - 1} className="rounded-lg border border-navy-200 p-2 text-navy-700 hover:bg-navy-50 disabled:opacity-30" aria-label="Fiche suivante"><ChevronRight size={17}/></button></> : null}<button ref={closeButton} type="button" onClick={close} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-navy-200 bg-white text-navy-600 shadow-sm hover:bg-navy-50" aria-label="Fermer"><X size={17}/></button></div>
        </header>
        <div className="min-h-0 flex-1 bg-navy-50/30"><iframe ref={iframe} title={`Fiche prospect — ${currentLabel}`} src={`/popup/prospect/${currentId}`} className="h-full w-full border-0 bg-white" /></div>
      </div>
    </div>
  ) : null;

  return <>
    <button type="button" onClick={() => { setCurrentId(prospectId); setOpen(true); }} className={className} aria-label={ariaLabel}>{children}</button>
    {mounted && modal ? createPortal(modal, document.body) : null}
  </>;
}
