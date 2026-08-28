"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Ligne, type LigneProspect } from "./ligne";
import { mettreCorbeilleEnMasse } from "../admin/corbeille/actions";
import { PROSPECT_STAGES } from "@/lib/domain/stages";

const TH = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-300";
type EtapeOption = { readonly label:string; readonly color:string; readonly category?:string };

export function ListeProspects({ lignes, afficherCommercial, peutSupprimer, triLiens, messageErreur, etapes = PROSPECT_STAGES, libelleVide = "Aucun prospect ne correspond." }: {
  lignes:LigneProspect[]; afficherCommercial:boolean; peutSupprimer:boolean; triLiens:{societe:string;etape:string;relance:string;action:string}; messageErreur?:string; etapes?:readonly EtapeOption[]; libelleVide?:string;
}) {
  const [selection,setSelection]=useState<Set<string>>(new Set());
  const [enCours,startTransition]=useTransition();
  const [message,setMessage]=useState<string|null>(null);
  function basculer(id:string){setSelection(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});}
  const toutCoche=lignes.length>0&&selection.size===lignes.length;
  const nbColonnes=(afficherCommercial?9:8)+(peutSupprimer?1:0);
  function supprimer(){const ids=[...selection];if(!confirm(`Mettre ${ids.length} fiche(s) à la corbeille ?`))return;setMessage(null);startTransition(async()=>{const r=await mettreCorbeilleEnMasse("prospect",ids);setMessage(r.message);if(r.ok)setSelection(new Set());});}
  return <>
    {peutSupprimer&&selection.size>0?<div className="flex flex-wrap items-center gap-3 border-b border-navy-100 bg-navy-50 px-4 py-2.5"><span className="text-sm font-semibold text-navy-800">{selection.size} sélectionné{selection.size>1?"s":""}</span><button type="button" onClick={supprimer} disabled={enCours} className="inline-flex h-9 items-center rounded-lg bg-navy-800 px-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">{enCours?"Suppression…":"Mettre à la corbeille"}</button><button type="button" onClick={()=>setSelection(new Set())} className="text-sm text-grey-brand underline">Tout décocher</button>{message?<span className="rounded px-2 py-1 text-xs text-navy-800" style={{backgroundColor:"var(--color-status-signe)"}}>{message}</span>:null}</div>:null}
    <div className="scroll-slim overflow-x-auto"><table className="w-full min-w-[72rem] border-collapse text-sm"><thead className="bg-navy-800"><tr>
      {peutSupprimer?<th className="w-10 px-3 py-2"><input type="checkbox" checked={toutCoche} onChange={e=>setSelection(e.currentTarget.checked?new Set(lignes.map(l=>l.id)):new Set())} className="h-4 w-4 accent-[var(--color-star-500)]"/></th>:null}
      <th className={TH}><Link href={triLiens.societe} className="hover:text-white">Société</Link></th><th className={TH}>Contact</th><th className={TH}>Téléphone</th><th className={TH}><Link href={triLiens.etape} className="hover:text-white">Étape</Link></th><th className={TH}><Link href={triLiens.relance} className="hover:text-white">Prochaine action</Link></th><th className={TH}>Notes</th><th className={TH}><Link href={triLiens.action} className="hover:text-white">Dernière action</Link></th>{afficherCommercial?<th className={TH}>Commercial</th>:null}<th className={TH}>Source</th>
    </tr></thead><tbody>
      {messageErreur?<tr><td colSpan={nbColonnes} className="px-3 py-6 text-sm text-navy-800">Lecture impossible : {messageErreur}</td></tr>:lignes.length===0?<tr><td colSpan={nbColonnes} className="px-3 py-10 text-center text-sm text-grey-brand">{libelleVide}</td></tr>:lignes.map(p=><Ligne key={p.id} p={p} afficherCommercial={afficherCommercial} selectionnable={peutSupprimer} coche={selection.has(p.id)} onToggle={basculer} etapes={etapes}/>) }
    </tbody></table></div>
  </>;
}
