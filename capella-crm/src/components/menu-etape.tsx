"use client";

import { useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/** Pastille d'étape modifiable en un clic. */
export function MenuEtape({
  id,
  etapeEnBase,
  etapes,
  couleur,
  action,
  resultat,
  libelle,
  className,
  libelleEtape,
}: {
  id: string;
  etapeEnBase: string;
  etapes: readonly { label: string }[];
  couleur: (etape: string) => string;
  action: (formData: FormData) => void;
  resultat: ActionResult | null;
  libelle: string;
  className?: string;
  libelleEtape?: (etape: string) => string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const motifKo = useRef<HTMLInputElement>(null);

  const [etape, setEtape] = useState(etapeEnBase);
  const [dernierEtatConnu, setDernierEtatConnu] = useState({ etape: etapeEnBase, reponse: resultat });

  if (dernierEtatConnu.etape !== etapeEnBase || dernierEtatConnu.reponse !== resultat) {
    setDernierEtatConnu({ etape: etapeEnBase, reponse: resultat });
    setEtape(etapeEnBase);
  }

  const texte = libelleEtape?.(etape) ?? etape;

  return (
    <form ref={form} action={action}>
      <input type="hidden" name="id" value={id} />
      <input ref={motifKo} type="hidden" name="ko_reason" defaultValue="" />
      <div
        className={cn(
          "relative inline-flex h-8 items-center rounded-full pl-3 pr-7",
          "focus-within:ring-2 focus-within:ring-star-500/40",
          className,
        )}
        style={{ backgroundColor: couleur(etape) }}
      >
        <span className="text-xs font-semibold whitespace-nowrap text-navy-800">{texte}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true" className="pointer-events-none absolute right-2.5 h-2.5 w-2.5 text-navy-800/60">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
        <select
          name="stage"
          value={etape}
          onChange={(e) => {
            const prochaine = e.currentTarget.value;
            if (prochaine === "KO") {
              const raison = window.prompt("Pourquoi ce dossier est-il KO ?\nLe motif sera visible dans le CRM et côté ADV.", "")?.trim();
              if (!raison) {
                e.currentTarget.value = etape;
                return;
              }
              if (motifKo.current) motifKo.current.value = raison;
            } else if (motifKo.current) {
              motifKo.current.value = "";
            }
            setEtape(prochaine);
            form.current?.requestSubmit();
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={libelle}
        >
          {etapes.map((s) => <option key={s.label} value={s.label}>{libelleEtape?.(s.label) ?? s.label}</option>)}
        </select>
      </div>
    </form>
  );
}
