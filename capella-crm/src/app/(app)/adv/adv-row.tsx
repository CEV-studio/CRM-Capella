"use client";

import { useActionState } from "react";
import { enregistrerAdv } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { AFFAIRE_STAGES } from "@/lib/domain/stages";
import { fmtEuros, fmtDate } from "@/lib/format";

export function AdvRow({a}:{a:{id:string;ref:string|null;raison_sociale:string;stage:string;commercial:string;taux:number;commission:number;date_signature:string|null}}){
 const [etat,action,enCours]=useActionState<ActionResult|null,FormData>(enregistrerAdv,null);
 const due=Number(a.commission||0)*Number(a.taux||0);
 const valide=a.stage==="Signé";
 const ko=a.stage==="KO";

 return <article className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
  <div className="flex items-start justify-between gap-3">
   <div className="min-w-0"><div className="truncate font-semibold text-navy-800">{a.raison_sociale}</div><div className="mt-0.5 text-xs text-grey-brand">{a.ref} · {a.commercial} · {(a.taux*100).toFixed(0)} %</div></div>
   <span className={valide?"shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800":ko?"shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800":"shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"}>{valide?"Signé":ko?"KO":a.stage}</span>
  </div>

  <div className="mt-4 grid grid-cols-2 gap-3">
   <div className="rounded-lg bg-navy-50 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-grey-brand">Commission Capella</div><div className="mt-1 text-lg font-bold text-navy-800">{fmtEuros(a.commission)}</div></div>
   <div className="rounded-lg bg-star-50 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-grey-brand">Part commercial</div><div className="mt-1 text-lg font-bold text-star-600">{fmtEuros(due)}</div></div>
  </div>

  {valide&&a.date_signature?<div className="mt-3 text-xs text-green-700">✓ Comptabilisé le {fmtDate(a.date_signature)}</div>:a.commission>0?<div className="mt-3 text-xs text-amber-700">Commission renseignée · validation finale à faire</div>:<div className="mt-3 text-xs text-grey-brand">Commission à renseigner</div>}

  <details className="mt-4 border-t border-navy-100 pt-3">
   <summary className="cursor-pointer select-none text-xs font-semibold text-navy-700">Modifier le dossier</summary>
   <form action={action} className="mt-3 space-y-3">
    <input type="hidden" name="id" value={a.id}/>
    <div className="grid gap-3 sm:grid-cols-3">
     <label className="text-xs font-medium text-navy-700">Statut<select name="stage" defaultValue={a.stage} className="mt-1 h-9 w-full rounded-lg border border-navy-200 bg-white px-2 text-xs">{AFFAIRE_STAGES.map(s=><option key={s.label} value={s.label}>{s.label}</option>)}</select></label>
     <label className="text-xs font-medium text-navy-700">Commission globale (€)<input name="commission" type="number" min="0" step="0.01" defaultValue={a.commission||""} className="mt-1 h-9 w-full rounded-lg border border-navy-200 px-2 text-sm"/></label>
     <label className="text-xs font-medium text-navy-700">Date de signature<input name="date_signature" type="date" defaultValue={a.date_signature??""} className="mt-1 h-9 w-full rounded-lg border border-navy-200 px-2 text-xs"/></label>
    </div>
    <div className="flex flex-wrap items-center gap-2">
     <button name="intention" value="enregistrer" disabled={enCours} className="h-9 rounded-lg border border-navy-200 bg-white px-3 text-xs font-semibold text-navy-800">{enCours?"…":"Enregistrer"}</button>
     {!valide?<button name="intention" value="signer" disabled={enCours} className="h-9 rounded-lg bg-navy-800 px-3 text-xs font-semibold text-white">Valider signé</button>:null}
     {etat?<span className={etat.ok?"text-xs text-green-700":"text-xs text-red-700"}>{etat.message}</span>:null}
    </div>
   </form>
  </details>
 </article>;
}
