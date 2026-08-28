"use client";
import Link from "next/link";
import { useActionState } from "react";
import { changerEtapeAffaire } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { MenuEtape } from "@/components/menu-etape";
import { AFFAIRE_STAGES, stageColor } from "@/lib/domain/stages";
import { fmtDate, fmtEuros } from "@/lib/format";
import type { Affaire } from "@/lib/domain/database.types";

export type CarteAffaire=Affaire&{commercial?:string|null;apporteur?:string|null};
export function Carte({a,afficherCommercial,commissionRate=1}:{a:CarteAffaire;afficherCommercial:boolean;commissionRate?:number}){
 const [etat,action]=useActionState<ActionResult|null,FormData>(changerEtapeAffaire,null);
 const relanceDepassee=a.date_relance!=null&&new Date(a.date_relance)<new Date();
 const etapesCommercial=AFFAIRE_STAGES.filter(s=>s.label!=="Signé");
 const commissionPerso=Number(a.commission??0)*commissionRate;
 const valideAdv=a.stage==="Signé";
 return <li className="rounded-lg border border-navy-100 bg-white p-3 shadow-sm">
  <Link href={`/conversion/${a.id}`} className="block truncate text-sm font-semibold text-navy-800 hover:text-star-600">{a.raison_sociale}</Link>
  <div className="tabular mt-0.5 text-[11px] text-grey-brand">{a.ref}{a.type_energie?` · ${a.type_energie}`:""}</div>
  <div className="mt-2">{valideAdv?<span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">Validé ADV</span>:<MenuEtape id={a.id} etapeEnBase={a.stage} etapes={etapesCommercial} couleur={e=>stageColor(e,"affaire")} action={action} resultat={etat} libelle={`Étape de ${a.raison_sociale}`}/>}</div>
  <dl className="mt-2 space-y-0.5 text-[11px] text-navy-700">{commissionPerso>0?<div className="flex justify-between gap-2"><dt className="text-grey-brand">Ma commission</dt><dd className="tabular font-bold text-star-600">{fmtEuros(commissionPerso)}</dd></div>:null}{a.date_signature?<div className="flex justify-between gap-2"><dt className="text-grey-brand">Validé le</dt><dd>{fmtDate(a.date_signature)}</dd></div>:null}{a.date_relance?<div className="flex justify-between gap-2"><dt className="text-grey-brand">Relance</dt><dd className={relanceDepassee?"font-semibold text-star-600":""}>{fmtDate(a.date_relance)}</dd></div>:null}{afficherCommercial&&a.commercial?<div className="flex justify-between"><dt className="text-grey-brand">Commercial</dt><dd>{a.commercial}</dd></div>:null}{a.apporteur?<div className="flex justify-between"><dt className="text-grey-brand">Apporteur</dt><dd>{a.apporteur}</dd></div>:null}</dl>
  {etat&&!etat.ok?<p className="mt-2 rounded px-2 py-1 text-[11px] text-red-700">{etat.message}</p>:null}
 </li>;
}
