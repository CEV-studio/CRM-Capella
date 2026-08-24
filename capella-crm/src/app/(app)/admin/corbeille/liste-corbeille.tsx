"use client";

import { useState, useTransition } from "react";
import { restaurerEnMasse, supprimerDefinitifEnMasse } from "./actions";
import { BoutonsCorbeille } from "./boutons";
import { Button } from "@/components/ui";

export type ItemCorbeille = { id: string; titre: string; sousTitre: string };

/**
 * Liste d'une corbeille (prospects ou affaires) avec sélection multiple :
 * cases à cocher, « tout sélectionner », et actions groupées Restaurer /
 * Supprimer définitivement. Les boutons de chaque ligne restent disponibles
 * pour agir sur un seul élément.
 */
export function ListeCorbeille({
  cible,
  items,
}: {
  cible: "prospect" | "affaire";
  items: ItemCorbeille[];
}) {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const tousCoches = items.length > 0 && selection.size === items.length;
  const nb = selection.size;

  function basculer(id: string) {
    setSelection((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  function toutBasculer() {
    setSelection(tousCoches ? new Set() : new Set(items.map((i) => i.id)));
  }

  function agir(
    fn: typeof restaurerEnMasse,
    confirmation?: string,
  ) {
    if (nb === 0) return;
    if (confirmation && !confirm(confirmation)) return;
    setErreur(null);
    const ids = [...selection];
    startTransition(async () => {
      const r = await fn(cible, ids);
      if (!r.ok) setErreur(r.message);
      else setSelection(new Set());
    });
  }

  return (
    <div>
      {/* Barre d'actions groupées */}
      <div className="flex flex-wrap items-center gap-3 border-b border-navy-100 px-5 py-3">
        <label className="flex items-center gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={tousCoches}
            onChange={toutBasculer}
            className="h-4 w-4 accent-[var(--color-star-500)]"
            aria-label="Tout sélectionner"
          />
          {nb > 0 ? `${nb} sélectionné(s)` : "Tout sélectionner"}
        </label>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9"
            disabled={nb === 0 || enCours}
            onClick={() => agir(restaurerEnMasse)}
          >
            Restaurer la sélection
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9"
            disabled={nb === 0 || enCours}
            onClick={() =>
              agir(
                supprimerDefinitifEnMasse,
                `Supprimer DÉFINITIVEMENT ${nb} élément(s) ?\n\nCette action est irréversible : les fiches et leurs pièces jointes seront effacées pour de bon.`,
              )
            }
          >
            Supprimer définitivement la sélection
          </Button>
        </div>

        {erreur ? (
          <span
            className="rounded px-2 py-1 text-xs text-navy-800"
            style={{ backgroundColor: "var(--color-status-perdu)" }}
          >
            {erreur}
          </span>
        ) : null}
      </div>

      <ul className="divide-y divide-navy-100">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
          >
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selection.has(it.id)}
                onChange={() => basculer(it.id)}
                className="h-4 w-4 accent-[var(--color-star-500)]"
                aria-label={`Sélectionner ${it.titre}`}
              />
              <span>
                <span className="block text-sm font-medium text-navy-800">
                  {it.titre}
                </span>
                <span className="tabular block text-xs text-grey-brand">
                  {it.sousTitre}
                </span>
              </span>
            </label>
            <BoutonsCorbeille cible={cible} id={it.id} libelle={it.titre} />
          </li>
        ))}
      </ul>
    </div>
  );
}
