"use client";

import { useActionState, useRef, useState } from "react";
import { Phone } from "lucide-react";
import { changerEtape, enregistrerProchaineAction } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { MenuEtape } from "@/components/menu-etape";
import { PROSPECT_STAGES, stageColor } from "@/lib/domain/stages";
import { ProspectNoteEditor } from "@/components/prospect-note-editor";
import { nomComplet } from "@/lib/domain/noms";
import { fmtDate, fmtDateHeure } from "@/lib/format";
import type { Prospect } from "@/lib/domain/database.types";
import { cn } from "@/lib/utils";
import { ProspectFichePopup } from "@/components/prospect-fiche-popup";

export type LigneProspect = Prospect & { commercial?: string | null; source?: string | null };
type EtapeOption = { readonly label: string; readonly color: string; readonly category?: string };
const CELL = "px-3 py-2 align-middle";

export function Ligne({ p, afficherCommercial, selectionnable = false, coche = false, onToggle, etapes = PROSPECT_STAGES }: {
  p: LigneProspect; afficherCommercial: boolean; selectionnable?: boolean; coche?: boolean; onToggle?: (id: string) => void; etapes?: readonly EtapeOption[];
}) {
  const [etatEtape, actionEtape] = useActionState<ActionResult | null, FormData>(changerEtape, null);
  const [etatAction, actionProchaine] = useActionState<ActionResult | null, FormData>(enregistrerProchaineAction, null);
  const [notesOuvertes, setNotesOuvertes] = useState(false);
  const formAction = useRef<HTMLFormElement>(null);
  const erreur = (!etatEtape?.ok && etatEtape?.message) || (!etatAction?.ok && etatAction?.message);
  const colSpan = (afficherCommercial ? 9 : 8) + (selectionnable ? 1 : 0);
  const prospectLabel = p.raison_sociale || nomComplet(p.nom, p.prenom);
  const numero = p.tel_mobile || p.tel_fixe;

  return <>
    <tr className={cn("border-b border-navy-100 hover:bg-navy-50", coche && "bg-star-50", notesOuvertes && "bg-navy-50")}>
      {selectionnable ? <td className={cn(CELL,"w-10")}><input type="checkbox" checked={coche} onChange={() => onToggle?.(p.id)} className="h-4 w-4 accent-[var(--color-star-500)]" aria-label={`Sélectionner ${p.raison_sociale ?? "ce prospect"}`} /></td> : null}
      <td className={cn(CELL,"min-w-56 max-w-72")}><ProspectFichePopup prospectId={p.id} prospectLabel={prospectLabel} className="block w-full truncate text-left font-semibold text-navy-800 hover:text-star-600" ariaLabel={`Ouvrir la fiche de ${prospectLabel}`}>{prospectLabel}</ProspectFichePopup><div className="tabular text-[11px] text-grey-brand">{p.ref}{p.siren ? ` · ${p.siren}` : ""}</div></td>
      <td className={cn(CELL,"text-navy-700")}>{nomComplet(p.nom,p.prenom,"—")}{p.mail ? <div className="truncate text-[11px] text-grey-brand">{p.mail}</div> : null}</td>
      <td className={cn(CELL,"tabular whitespace-nowrap text-navy-700")}>{numero ? <div className="flex items-center gap-2"><a href={`tel:${numero}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-navy-900 px-2.5 text-xs font-bold text-white shadow-sm hover:bg-navy-700" aria-label={`Appeler ${prospectLabel}`}><Phone size={13}/>Appeler</a><span className="text-xs text-navy-600">{numero}{!p.tel_mobile ? <span className="ml-1 text-[10px] text-grey-brand">(fixe)</span> : null}</span></div> : <span className="text-grey-brand">—</span>}</td>
      <td className={CELL}><MenuEtape id={p.id} etapeEnBase={p.stage} etapes={etapes} couleur={(e)=>stageColor(e,"prospect")} action={actionEtape} resultat={etatEtape} libelle={`Étape de ${p.raison_sociale ?? "ce prospect"}`} />{p.legacy_sheet?<div className="mt-1 whitespace-nowrap rounded-full bg-sky-capella-50 px-2 py-0.5 text-[10px] font-bold text-sky-capella-700">Ancien : {p.legacy_sheet}</div>:null}</td>
      <td className={CELL}><form ref={formAction} action={actionProchaine} className="flex items-center gap-1.5"><input type="hidden" name="id" value={p.id}/><input name="next_action" defaultValue={p.next_action??""} onBlur={()=>formAction.current?.requestSubmit()} placeholder="À faire…" className="h-8 w-40 rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-navy-200 focus:border-star-500 focus:bg-white focus:outline-none"/><input type="date" name="next_action_date" defaultValue={p.next_action_date??""} onChange={()=>formAction.current?.requestSubmit()} className="tabular h-8 w-32 rounded-md border border-transparent bg-transparent px-1 text-xs hover:border-navy-200 focus:border-star-500 focus:bg-white focus:outline-none"/></form></td>
      <td className={cn(CELL,"min-w-44 max-w-60")}><button type="button" onClick={()=>setNotesOuvertes(v=>!v)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white"><span aria-hidden>📝</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-navy-700">{p.notes?"Note":"Ajouter une note"}</span>{p.notes?<span className="block truncate text-[11px] text-grey-brand" title={p.notes}>{p.notes}</span>:null}</span></button></td>
      <td className={cn(CELL,"tabular whitespace-nowrap text-xs text-grey-brand")}>{fmtDateHeure(p.last_action_at)}</td>
      {afficherCommercial ? <td className={cn(CELL,"whitespace-nowrap text-xs text-navy-700")}>{p.commercial ?? <span className="text-star-600">Réservoir</span>}</td> : null}
      <td className={cn(CELL,"whitespace-nowrap text-xs text-grey-brand")}>{p.source??"—"}{p.date_fin_contrat?<div className="tabular">fin : {fmtDate(p.date_fin_contrat)}</div>:null}</td>
    </tr>
    {notesOuvertes ? <tr className="border-b border-navy-100 bg-navy-50/70"><td colSpan={colSpan} className="px-4 py-3"><div className="ml-auto max-w-3xl rounded-xl border border-navy-100 bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between gap-3"><div className="text-xs font-semibold text-navy-800">Note — {p.raison_sociale || nomComplet(p.nom,p.prenom)}</div><button type="button" onClick={()=>setNotesOuvertes(false)} className="text-xs text-grey-brand underline">Fermer</button></div><ProspectNoteEditor prospectId={p.id} initialNotes={p.notes} compact /></div></td></tr> : null}
    {erreur ? <tr><td colSpan={colSpan} className="px-3 pb-2"><p role="alert" className="rounded-lg px-3 py-1.5 text-xs text-navy-800" style={{backgroundColor:"var(--color-status-perdu)"}}>{erreur}</p></td></tr> : null}
  </>;
}
