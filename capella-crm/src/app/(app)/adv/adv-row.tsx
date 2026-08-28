"use client";
import { useActionState } from "react";
import { enregistrerAdv } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { AFFAIRE_STAGES } from "@/lib/domain/stages";
import { fmtEuros } from "@/lib/format";

export function AdvRow({a}:{a:{id:string;ref:string|null;raison_sociale:string;stage:string;commercial:string;taux:number;commission:number;date_signature:string|null}}){
 const [etat,action,enCours]=useActionState<ActionResult|null,FormData>(enregistrerAdv,null);const due=Number(a.commission||0)*Number(a.taux||0);
 return <form action={action} className="grid grid-cols-[1.1fr_1.4fr_1fr_1fr_1fr_1fr_auto] items-center gap-2 border-b border-navy-100 px-3 py-2 text-sm"><input type="hidden" name="id" value={a.id}/><div><div className="font-semibold text-navy-800">{a.raison_sociale}</div><div className="text-[11px] text-grey-brand">{a.ref}</div></div><div className="text-navy-700">{a.commercial}<div className="text-[11px] text-grey-brand">{(a.taux*100).toFixed(0)} %</div></div><select name="stage" defaultValue={a.stage} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-xs">{AFFAIRE_STAGES.map(s=><option key={s.label} value={s.label}>{s.label}</option>)}</select><input name="commission" type="number" min="0" step="0.01" defaultValue={a.commission||""} placeholder="Commission globale" className="h-9 rounded-lg border border-navy-200 px-2 text-sm"/><div className="font-semibold text-star-600">{fmtEuros(due)}</div><input name="date_signature" type="date" defaultValue={a.date_signature??""} className="h-9 rounded-lg border border-navy-200 px-2 text-xs"/><div className="flex items-center gap-2"><button disabled={enCours} className="h-9 rounded-lg bg-navy-800 px-3 text-xs font-semibold text-white">{enCours?"…":"Enregistrer"}</button>{etat?<span className={etat.ok?"text-[10px] text-green-700":"text-[10px] text-red-700"}>{etat.ok?"✓":etat.message}</span>:null}</div></form>;
}
