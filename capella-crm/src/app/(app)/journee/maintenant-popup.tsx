"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Flame, X } from "lucide-react";

export function MaintenantPopup({ count, children }: { count: number; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-2xl border border-star-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[var(--crm-shadow-hover)]"
        aria-haspopup="dialog"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-star-700">À faire maintenant</span>
          <Flame size={17} className="text-star-500" />
        </div>
        <div className="mt-2 font-display text-3xl font-black text-navy-900">{count}</div>
        <div className="mt-1 text-xs text-grey-brand">Retards, RDV, rappels et dossiers chauds</div>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <button type="button" className="absolute inset-0 bg-navy-950/45" onClick={() => setIsOpen(false)} aria-label="Fermer la fenêtre" />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="maintenant-title"
            className="relative z-10 max-h-[88vh] w-full max-w-[760px] overflow-hidden rounded-3xl border border-navy-100 bg-white text-navy-900 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-navy-100 bg-white px-5 py-4 sm:px-6">
              <div>
                <h2 id="maintenant-title" className="font-display text-xl font-bold text-navy-900">À faire maintenant</h2>
                <p className="mt-1 text-xs text-grey-brand">Traite cette file de haut en bas.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-navy-200 bg-white text-navy-700 hover:bg-navy-50"
                aria-label="Fermer"
              >
                <X size={17} />
              </button>
            </div>
            <div className="max-h-[calc(88vh-82px)] overflow-y-auto p-4 sm:p-6">
              {count ? <div className="space-y-3">{children}</div> : <div className="rounded-2xl border border-dashed border-green-200 bg-green-50/50 p-10 text-center"><div className="font-display text-lg font-bold text-green-800">Votre journée est à jour — aucune action prévue pour le moment.</div></div>}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
