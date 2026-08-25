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

function estComparatif(piece: PieceJointe): boolean {
  return piece.type === "Facture" && piece.file_name.toLowerCase().startsWith("comparatif_");
}

function LignePiece({ piece, lectureSeule }: { piece: PieceJointe; lectureSeule: boolean }) {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(supprimerPiece, null);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <a href={`/pieces/${piece.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-navy-800 underline underline-offset-2 hover:text-star-600" title={piece.file_name}>{piece.file_name}</a>
      <span className="tabular shrink-0 text-xs text-grey-brand">{poids(piece.taille)}</span>
      {lectureSeule ? <span className="shrink-0 text-[11px] text-grey-brand">du prospect</span> : (
        <form action={action} className="shrink-0">
          <input type="hidden" name="id" value={piece.id} />
          <button type="submit" disabled={enCours} className="text-xs text-navy-400 underline underline-offset-2 hover:text-star-600 disabled:opacity-50">{enCours ? "…" : "supprimer"}</button>
          {etat && !etat.ok ? <span className="ml-2 text-[11px] text-star-600">{etat.message}</span> : null}
        </form>
      )}
    </li>
  );
}

function ListeDocuments({ titre, pieces, heritees = [] }: { titre: string; pieces: PieceJointe[]; heritees?: PieceJointe[] }) {
  const vide = pieces.length === 0 && heritees.length === 0;
  return (
    <div>
      <div className="border-b border-navy-100 px-4 py-2 text-sm font-semibold text-navy-800">{titre}</div>
      {vide ? <p className="px-4 py-2 text-xs text-grey-brand">Aucun document.</p> : (
        <ul className="divide-y divide-navy-50">
          {pieces.map((p) => <LignePiece key={p.id} piece={p} lectureSeule={false} />)}
          {heritees.map((p) => <LignePiece key={p.id} piece={p} lectureSeule />)}
        </ul>
      )}
    </div>
  );
}

function SectionUpload({ titre, type, scope, parentId, pieces, heritees }: {
  titre: string; type: TypePiece; scope: "prospect" | "affaire"; parentId: string; pieces: PieceJointe[]; heritees: PieceJointe[];
}) {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(ajouterPiece, null);
  const [fichiers, setFichiers] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const propres = pieces.filter((p) => p.type === type && !estComparatif(p));
  const dHeritees = heritees.filter((p) => p.type === type && !estComparatif(p));
  const libelleSelection = fichiers.length ? (fichiers.length === 1 ? fichiers[0] : `${fichiers.length} fichiers sélectionnés`) : "PDF, JPG ou PNG · 10 Mo max par fichier";

  return (
    <div>
      <ListeDocuments titre={titre} pieces={propres} heritees={dHeritees} />
      <form action={action} className="flex flex-wrap items-center gap-2 border-t border-navy-100 px-4 py-2.5">
        <input type="hidden" name="scope" value={scope} /><input type="hidden" name="parent_id" value={parentId} /><input type="hidden" name="type" value={type} />
        <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-navy-200 px-3 text-xs font-semibold text-navy-700 hover:bg-navy-50">Choisir des fichiers
          <input ref={inputRef} type="file" name="fichiers" accept="application/pdf,image/jpeg,image/png" multiple required className="sr-only" onChange={(e) => setFichiers(Array.from(e.currentTarget.files ?? []).map((f) => f.name))} />
        </label>
        <span className="min-w-0 flex-1 truncate text-xs text-grey-brand" title={fichiers.join(", ")}>{libelleSelection}</span>
        <button type="submit" disabled={enCours || fichiers.length === 0} className="inline-flex h-9 items-center rounded-lg bg-star-500 px-3 text-xs font-semibold text-white hover:bg-star-600 disabled:opacity-50">{enCours ? "Envoi…" : fichiers.length > 1 ? `Ajouter les ${fichiers.length}` : "Ajouter"}</button>
        {etat ? <span className="w-full rounded px-2 py-1 text-xs text-navy-800" style={{ backgroundColor: etat.ok ? "var(--color-status-signe)" : "var(--color-status-perdu)" }}>{etat.message}</span> : null}
      </form>
    </div>
  );
}

export function PiecesJointes({ scope, parentId, pieces, heritees = [] }: { scope: "prospect" | "affaire"; parentId: string; pieces: PieceJointe[]; heritees?: PieceJointe[] }) {
  const comparatifs = pieces.filter(estComparatif);
  const comparatifsHerites = heritees.filter(estComparatif);

  return (
    <Card>
      <CardHeader title="Documents" hint="ACD, factures et comparatifs enregistrés sur la fiche." />
      <div className="grid gap-px bg-navy-100 lg:grid-cols-3">
        <div className="bg-white"><SectionUpload titre="ACD" type="ACD" scope={scope} parentId={parentId} pieces={pieces} heritees={heritees} /></div>
        <div className="bg-white"><SectionUpload titre="Factures" type="Facture" scope={scope} parentId={parentId} pieces={pieces} heritees={heritees} /></div>
        <div className="bg-white"><ListeDocuments titre="Comparatifs" pieces={comparatifs} heritees={comparatifsHerites} /></div>
      </div>
    </Card>
  );
}
