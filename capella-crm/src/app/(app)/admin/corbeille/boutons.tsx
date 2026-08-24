"use client";

import { useState, useTransition } from "react";
import { restaurer, supprimerDefinitif } from "./actions";
import { Button } from "@/components/ui";

/** Boutons Restaurer / Supprimer définitivement d'une ligne de corbeille. */
export function BoutonsCorbeille({
  cible,
  id,
  libelle,
}: {
  cible: "prospect" | "affaire";
  id: string;
  libelle: string;
}) {
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function agir(fn: typeof restaurer) {
    setErreur(null);
    startTransition(async () => {
      const r = await fn(cible, id);
      if (!r.ok) setErreur(r.message);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        className="h-9"
        disabled={enCours}
        onClick={() => agir(restaurer)}
      >
        Restaurer
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-9"
        disabled={enCours}
        onClick={() => {
          if (
            confirm(
              `Supprimer DÉFINITIVEMENT « ${libelle} » ?\n\nCette action est irréversible : la fiche et ses pièces jointes seront effacées pour de bon.`,
            )
          ) {
            agir(supprimerDefinitif);
          }
        }}
      >
        Supprimer définitivement
      </Button>
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
