"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Ligne, type LigneProspect } from "./ligne";
import { mettreCorbeilleEnMasse } from "../admin/corbeille/actions";

const TH =
  "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-300";

/**
 * Tableau des prospects avec sélection multiple.
 * La sélection et la barre d'action « supprimer en masse » sont côté client ;
 * la suppression reste réservée à la gestion d'équipe (peutSupprimer).
 */
export function ListeProspects({
  lignes,
  afficherCommercial,
  peutSupprimer,
  triLiens,
  messageErreur,
}: {
  lignes: LigneProspect[];
  afficherCommercial: boolean;
  peutSupprimer: boolean;
  triLiens: { societe: string; etape: string; relance: string; action: string };
  messageErreur?: string;
}) {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [enCours, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function basculer(id: string) {
    setSelection((s) => {
      const suivant = new Set(s);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  const toutCoche = lignes.length > 0 && selection.size === lignes.length;
  const nbColonnes = (afficherCommercial ? 8 : 7) + (peutSupprimer ? 1 : 0);

  function supprimer() {
    const ids = [...selection];
    if (
      !confirm(
        `Mettre ${ids.length} prospect(s) à la corbeille ?\n\nTu pourras les restaurer depuis Administration › Corbeille.`,
      )
    )
      return;
    setMessage(null);
    startTransition(async () => {
      const r = await mettreCorbeilleEnMasse("prospect", ids);
      setMessage(r.message);
      if (r.ok) setSelection(new Set());
    });
  }

  return (
    <>
      {peutSupprimer && selection.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-navy-100 bg-navy-50 px-4 py-2.5">
          <span className="text-sm font-semibold text-navy-800">
            {selection.size} sélectionné{selection.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={supprimer}
            disabled={enCours}
            className="inline-flex h-9 items-center rounded-lg bg-navy-800 px-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
          >
            {enCours ? "Suppression…" : "Mettre à la corbeille"}
          </button>
          <button
            type="button"
            onClick={() => setSelection(new Set())}
            className="text-sm text-grey-brand underline underline-offset-2 hover:text-navy-700"
          >
            Tout décocher
          </button>
          {message ? (
            <span
              className="rounded px-2 py-1 text-xs text-navy-800"
              style={{ backgroundColor: "var(--color-status-signe)" }}
            >
              {message}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="scroll-slim overflow-x-auto">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <thead className="bg-navy-800">
            <tr>
              {peutSupprimer ? (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={toutCoche}
                    onChange={(e) =>
                      setSelection(
                        e.currentTarget.checked
                          ? new Set(lignes.map((l) => l.id))
                          : new Set(),
                      )
                    }
                    className="h-4 w-4 accent-[var(--color-star-500)]"
                    aria-label="Tout sélectionner"
                  />
                </th>
              ) : null}
              <th className={TH}>
                <Link href={triLiens.societe} className="hover:text-white">
                  Société
                </Link>
              </th>
              <th className={TH}>Contact</th>
              <th className={TH}>Téléphone</th>
              <th className={TH}>
                <Link href={triLiens.etape} className="hover:text-white">
                  Étape
                </Link>
              </th>
              <th className={TH}>
                <Link href={triLiens.relance} className="hover:text-white">
                  Prochaine action
                </Link>
              </th>
              <th className={TH}>
                <Link href={triLiens.action} className="hover:text-white">
                  Dernière action
                </Link>
              </th>
              {afficherCommercial ? <th className={TH}>Commercial</th> : null}
              <th className={TH}>Source</th>
            </tr>
          </thead>
          <tbody>
            {messageErreur ? (
              <tr>
                <td colSpan={nbColonnes} className="px-3 py-6 text-sm text-navy-800">
                  Lecture impossible : {messageErreur}
                </td>
              </tr>
            ) : lignes.length === 0 ? (
              <tr>
                <td
                  colSpan={nbColonnes}
                  className="px-3 py-10 text-center text-sm text-grey-brand"
                >
                  Aucun prospect ne correspond.{" "}
                  <Link
                    href="/prospection/nouveau"
                    className="text-star-600 underline underline-offset-2"
                  >
                    En créer un
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              lignes.map((p) => (
                <Ligne
                  key={p.id}
                  p={p}
                  afficherCommercial={afficherCommercial}
                  selectionnable={peutSupprimer}
                  coche={selection.has(p.id)}
                  onToggle={basculer}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
