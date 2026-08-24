"use client";

import { useActionState, useRef, useState } from "react";
import { ajouterPiece, supprimerPiece } from "@/app/(app)/pieces/actions";
import type { ActionResult } from "@/lib/action-result";
import { Card, CardHeader } from "@/components/ui";
import type { PieceJointe } from "@/lib/domain/database.types";

type TypePiece = "ACD" | "Facture";

function poids(o: number | null): string {
  if (!o) return "";
  if (o < 1024 * 1024) return `${Math.round(o / 1024)} Ko`;
  return `${(o / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Une pièce : nom cliquable (téléchargement signé) + suppression éventuelle. */
function LignePiece({
  piece,
  lectureSeule,
}: {
  piece: PieceJointe;
  lectureSeule: boolean;
}) {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    supprimerPiece,
    null,
  );

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <a
        href={`/pieces/${piece.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate text-navy-800 underline underline-offset-2 hover:text-star-600"
        title={piece.file_name}
      >
        {piece.file_name}
      </a>
      <span className="tabular shrink-0 text-xs text-grey-brand">
        {poids(piece.taille)}
      </span>
      {lectureSeule ? (
        <span className="shrink-0 text-[11px] text-grey-brand">du prospect</span>
      ) : (
        <form action={action} className="shrink-0">
          <input type="hidden" name="id" value={piece.id} />
          <button
            type="submit"
            disabled={enCours}
            className="text-xs text-navy-400 underline underline-offset-2 hover:text-star-600 disabled:opacity-50"
          >
            {enCours ? "…" : "supprimer"}
          </button>
          {etat && !etat.ok ? (
            <span className="ml-2 text-[11px] text-star-600">{etat.message}</span>
          ) : null}
        </form>
      )}
    </li>
  );
}

/** Une section (ACD ou Facture) : liste + zone d'ajout. */
function Section({
  titre,
  type,
  scope,
  parentId,
  pieces,
  heritees,
}: {
  titre: string;
  type: TypePiece;
  scope: "prospect" | "affaire";
  parentId: string;
  pieces: PieceJointe[];
  heritees: PieceJointe[];
}) {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    ajouterPiece,
    null,
  );
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const propres = pieces.filter((p) => p.type === type);
  const dHeritees = heritees.filter((p) => p.type === type);
  const vide = propres.length === 0 && dHeritees.length === 0;

  return (
    <div>
      <div className="border-b border-navy-100 px-4 py-2 text-sm font-semibold text-navy-800">
        {titre}
      </div>

      {vide ? (
        <p className="px-4 py-2 text-xs text-grey-brand">Aucun document.</p>
      ) : (
        <ul className="divide-y divide-navy-50">
          {propres.map((p) => (
            <LignePiece key={p.id} piece={p} lectureSeule={false} />
          ))}
          {dHeritees.map((p) => (
            <LignePiece key={p.id} piece={p} lectureSeule />
          ))}
        </ul>
      )}

      <form
        action={action}
        className="flex flex-wrap items-center gap-2 border-t border-navy-100 px-4 py-2.5"
      >
        <input type="hidden" name="scope" value={scope} />
        <input type="hidden" name="parent_id" value={parentId} />
        <input type="hidden" name="type" value={type} />
        <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-navy-200 px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50">
          Choisir un fichier
          <input
            ref={inputRef}
            type="file"
            name="fichier"
            accept="application/pdf,image/jpeg,image/png"
            required
            className="sr-only"
            onChange={(e) => setNomFichier(e.currentTarget.files?.[0]?.name ?? null)}
          />
        </label>
        <span className="min-w-0 flex-1 truncate text-xs text-grey-brand">
          {nomFichier ?? "PDF, JPG ou PNG · 10 Mo max"}
        </span>
        <button
          type="submit"
          disabled={enCours || !nomFichier}
          className="inline-flex h-9 items-center rounded-lg bg-star-500 px-3 text-xs font-semibold text-white hover:bg-star-600 disabled:opacity-50"
        >
          {enCours ? "Envoi…" : "Ajouter"}
        </button>
        {etat && !etat.ok ? (
          <span
            className="w-full rounded px-2 py-1 text-xs text-navy-800"
            style={{ backgroundColor: "var(--color-status-perdu)" }}
          >
            {etat.message}
          </span>
        ) : null}
      </form>
    </div>
  );
}

/**
 * Bloc « Documents » d'une fiche : deux sections ACD et Facture.
 * `heritees` = pièces du prospect d'origine, montrées en lecture seule sur
 * une affaire.
 */
export function PiecesJointes({
  scope,
  parentId,
  pieces,
  heritees = [],
}: {
  scope: "prospect" | "affaire";
  parentId: string;
  pieces: PieceJointe[];
  heritees?: PieceJointe[];
}) {
  return (
    <Card>
      <CardHeader
        title="Documents"
        hint="ACD et factures. Plusieurs fichiers possibles par catégorie."
      />
      <div className="grid gap-px bg-navy-100 sm:grid-cols-2">
        <div className="bg-white">
          <Section
            titre="ACD"
            type="ACD"
            scope={scope}
            parentId={parentId}
            pieces={pieces}
            heritees={heritees}
          />
        </div>
        <div className="bg-white">
          <Section
            titre="Facture"
            type="Facture"
            scope={scope}
            parentId={parentId}
            pieces={pieces}
            heritees={heritees}
          />
        </div>
      </div>
    </Card>
  );
}
