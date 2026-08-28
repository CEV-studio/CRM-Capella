"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changerEtape } from "./actions";
import type { LigneProspect } from "./ligne";
import type { ActionResult } from "@/lib/action-result";
import { MenuEtape } from "@/components/menu-etape";
import { PROSPECT_STAGES, stageColor } from "@/lib/domain/stages";
import { nomComplet } from "@/lib/domain/noms";
import { fmtDate } from "@/lib/format";

type EtapeOption = { readonly label:string; readonly color:string; readonly category?:string };

function CarteProspect({ p, afficherCommercial, etapes }: { p:LigneProspect; afficherCommercial:boolean; etapes:readonly EtapeOption[] }) {
  const [etat,action]=useActionState<ActionResult|null,FormData>(changerEtape,null);
  return <li className="rounded-lg border border-navy-100 bg-white p-3 shadow-sm">
    <Link href={`/prospection/${p.id}`} prefetch={false} className="block truncate text-sm font-semibold text-navy-800 hover:text-star-600" title={p.raison_sociale??undefined}>{p.raison_sociale||nomComplet(p.nom,p.prenom)}</Link>
    <div className="tabular mt-0.5 text-[11px] text-grey-brand">{p.ref}{p.tel_mobile?` · ${p.tel_mobile}`:p.tel_fixe?` · ${p.tel_fixe} (fixe)`:""}</div>
    <div className="mt-2"><MenuEtape id={p.id} etapeEnBase={p.stage} etapes={etapes} couleur={e=>stageColor(e,"prospect")} action={action} resultat={etat} libelle={`Étape de ${p.raison_sociale??"cette fiche"}`}/></div>
    {p.next_action||p.next_action_date?<div className="mt-2 text-[11px] text-navy-700">{p.next_action}{p.next_action_date?<span className="tabular text-grey-brand">{p.next_action?" · ":""}{fmtDate(p.next_action_date)}</span>:null}</div>:null}
    <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-grey-brand">{afficherCommercial?<span>{p.commercial??"Réservoir"}</span>:null}{p.source?<span>· {p.source}</span>:null}</div>
    {etat&&!etat.ok?<p role="alert" className="mt-2 rounded px-2 py-1 text-[11px] text-navy-800" style={{backgroundColor:"var(--color-status-perdu)"}}>{etat.message}</p>:null}
  </li>;
}

const MAX_CARTES=60;
export function KanbanProspection({ lignes, afficherCommercial, etapes=PROSPECT_STAGES, libelleVide="Aucun prospect" }: { lignes:LigneProspect[]; afficherCommercial:boolean; etapes?:readonly EtapeOption[]; libelleVide?:string }) {
  const parEtape=new Map<string,LigneProspect[]>(etapes.map(s=>[s.label,[]]));
  for(const p of lignes) parEtape.get(p.stage)?.push(p);
  return <div className="scroll-slim overflow-x-auto pb-3"><div className="flex min-w-max gap-4">{etapes.map(etape=>{const cartes=parEtape.get(etape.label)??[];return <section key={etape.label} className="w-64 shrink-0"><header className="flex items-center justify-between rounded-t-lg px-3 py-2" style={{backgroundColor:stageColor(etape.label,"prospect")}}><h2 className="text-sm font-semibold text-navy-800">{etape.label}</h2><span className="tabular rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-navy-800">{cartes.length}</span></header><ul className="min-h-24 space-y-2 rounded-b-lg border border-navy-100 bg-navy-50 p-2">{cartes.length===0?<li className="px-2 py-6 text-center text-xs text-grey-brand">{libelleVide}</li>:<>{cartes.slice(0,MAX_CARTES).map(p=><CarteProspect key={p.id} p={p} afficherCommercial={afficherCommercial} etapes={etapes}/>)}{cartes.length>MAX_CARTES?<li className="px-2 py-2 text-center text-xs text-grey-brand">+ {cartes.length-MAX_CARTES} autre(s)</li>:null}</>}</ul></section>;})}</div></div>;
}
