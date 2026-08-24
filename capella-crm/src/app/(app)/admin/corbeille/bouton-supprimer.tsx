"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mettreCorbeille } from "./actions";

/** Bouton « Supprimer » d'une fiche : envoie l'élément à la corbeille. */
export function BoutonSupprimer({
  cible,
  id,
  libelle,
  retour,
}: {
  cible: "prospect" | "affaire";
  id: string;
  libelle: string;
  /** Où revenir après suppression (liste prospection ou pipeline). */
  retour: string;
}) {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={enCours}
        onClick={() => {
          if (
            confirm(
              `Mettre « ${libelle} » à la corbeille ?\n\nTu pourras le restaurer depuis Administration › Corbeille.`,
            )
          ) {
            setErreur(null);
            startTransition(async () => {
              const r = await mettreCorbeille(cible, id);
              if (r.ok) router.push(retour);
              else setErreur(r.message);
            });
          }
        }}
        className="inline-flex h-9 items-center rounded-lg border border-navy-200 px-3 text-sm font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"
      >
        {enCours ? "Suppression…" : "Supprimer"}
      </button>
      {erreur ? (
        <span
          className="rounded px-2 py-1 text-xs text-navy-800"
          style={{ backgroundColor: "var(--color-status-perdu)" }}
        >
          {erreur}
        </span>
      ) : null}
    </div>
  );
}
