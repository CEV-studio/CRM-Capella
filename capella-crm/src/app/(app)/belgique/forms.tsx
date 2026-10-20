'use client';
import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button,Input,Field } from '@/components/ui';
import { createInvoice,updateInvoice,saveCycle,saveSupplierBilling } from './actions';
import type { Invoice,CycleTracking,SupplierBilling } from '@/lib/belgium/domain';
type Preview={count:number;added:number;statusChanges:number;blocked:boolean;warning:string;changes:{key:string;client:string;centre:string;before:string;after:string;kind:string}[]};
const select='h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm';
export function ImportForm({today}:{today:string}){
 const [preview,setPreview]=useState<Preview|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);const saved=useRef<FormData|null>(null);const router=useRouter();
 async function send(form:FormData,confirm=false){setBusy(true);setMessage('');try{if(confirm)form.set('confirm','yes');const response=await fetch('/api/belgique/import',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw new Error(data.error);if(confirm){setPreview(null);setMessage(`Import enregistré : ${data.result.added} ajouts, ${data.result.changed} contrats actualisés, ${data.result.unchanged} inchangés. Comparaison avec le dernier import du CRM.`);router.refresh();}else{saved.current=form;setPreview(data);}}catch(e){setMessage(e instanceof Error?e.message:'Erreur');}finally{setBusy(false);}}
 return <div className="space-y-4"><form onSubmit={e=>{e.preventDefault();void send(new FormData(e.currentTarget));}} onChange={()=>setPreview(null)} className="grid gap-4 md:grid-cols-2"><Field label="Type de fichier"><select name="kind" className={select}><option value="report">Reporting quotidien / registre central</option><option value="statement">Appel officiel MEGA</option></select></Field><Field label="Date du reporting / réception de l’appel"><Input name="date" type="date" required defaultValue={today} max={today}/></Field><Field label="Période de l’appel officiel" hint="Ignorée pour un reporting quotidien."><Input name="period" type="month" defaultValue={today.slice(0,7)}/></Field><Field label="Fichier CSV ou XLSX"><Input name="file" type="file" accept=".csv,.tsv,.xlsx" required/></Field><Button disabled={busy} type="submit">{busy?'Lecture en cours…':'Vérifier avant import'}</Button></form>
 <p className="text-sm" role="status">{message}</p>{preview&&<div className="space-y-3"><p className="font-semibold">{preview.count} lignes · {preview.added} ajouts · {preview.statusChanges} changements de statut depuis le dernier import du CRM.</p><p className="text-sm text-grey-brand">{preview.warning}</p><div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead><tr>{['Client / clé','Centre','Avant','Après','Changement'].map(h=><th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{preview.changes.map(c=><tr key={c.key} className="border-t border-navy-100"><td className="p-2">{c.client}<div className="text-xs">{c.key}</div></td><td>{c.centre}</td><td>{c.before}</td><td>{c.after}</td><td>{c.kind}</td></tr>)}</tbody></table></div><Button disabled={busy||preview.blocked} onClick={()=>saved.current&&void send(saved.current,true)}>{busy?'Enregistrement…':'Confirmer cet import dans le CRM'}</Button></div>}</div>;
}
export function InvoiceForm({period}:{period:string}){const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);return <form className="grid gap-3 md:grid-cols-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await createInvoice(new FormData(e.currentTarget));setMessage(r.error??r.success??'');}catch{setMessage('Établissement impossible.');}finally{setBusy(false);}}}><Field label="Centre"><select name="centre" className={select}><option>TILIRA</option><option>Cimsourse</option></select></Field><Field label="Période validée MEGA"><Input type="month" name="period" defaultValue={period.slice(0,7)} required/></Field><Field label="Référence de l’appel"><Input name="reference" required minLength={3} placeholder="AAF-TILIRA-2026-10"/></Field><Button className="self-end" disabled={busy}>Établir l’appel</Button><p className="text-sm md:col-span-4" role="status">{message}</p></form>;}
export function InvoiceStateForm({invoice:i}:{invoice:Invoice}){const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);return <form className="flex flex-wrap items-end gap-2" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await updateInvoice(new FormData(e.currentTarget));setMessage(r.error??r.success??'');}finally{setBusy(false);}}}><input type="hidden" name="id" value={i.id}/><Field label="État"><select name="state" defaultValue={i.state} className={select}>{['Établie','Émise','Payée'].map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Transmission confirmée"><Input name="issued_at" type="date" defaultValue={i.issued_at??''}/></Field><Field label="Règlement confirmé"><Input name="paid_at" type="date" defaultValue={i.paid_at??''}/></Field><Button disabled={busy} variant="ghost">Enregistrer</Button><span role="status" className="text-xs">{message}</span></form>;}

export function CycleForm({contractKey,value}:{contractKey:string;value?:CycleTracking}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={async e=>{
  e.preventDefault();const form=new FormData(e.currentTarget);setBusy(true);
  try{const result=await saveCycle(form);setMessage(result.error??result.success??'');}catch{setMessage('Enregistrement impossible');}finally{setBusy(false);}
 }}>
 <input type="hidden" name="contract_key" value={contractKey}/>
 <Field label="Prise d’effet confirmée"><Input type="date" name="effect_date" defaultValue={value?.effect_date??''}/></Field>
 <Field label="Résiliation confirmée"><Input type="date" name="termination_date" defaultValue={value?.termination_date??''}/></Field>
 <Field label="Cycle de 3 mois confirmé accompli le"><Input type="date" name="completed_at" defaultValue={value?.completed_at??''}/></Field>
 <Field label="Bonus de 10 € facturé le"><Input type="date" name="bonus_invoiced_at" defaultValue={value?.bonus_invoiced_at??''}/></Field>
 <Field label="Bonus de 10 € encaissé le"><Input type="date" name="bonus_paid_at" defaultValue={value?.bonus_paid_at??''}/></Field>
 <Field label="Déjà récupéré auprès du centre (€)"><Input type="number" step="0.01" min="0" name="centre_recovered" defaultValue={(value?.centre_recovered_cents??0)/100}/></Field>
 <Field label="Déjà repris par MEGA (€)"><Input type="number" step="0.01" min="0" name="mega_recovered" defaultValue={(value?.mega_recovered_cents??0)/100}/></Field>
 <Field label="Justificatif / notes"><Input name="notes" defaultValue={value?.notes??''}/></Field>
 <Button disabled={busy} className="self-end">Confirmer les informations</Button>
 <p className="text-xs text-grey-brand sm:col-span-2 lg:col-span-3">Renseigner des dates et montants vérifiés. Les dates observées lors d’un reporting ne sont pas automatiquement des dates confirmées.</p>
 <p role="status" className="text-sm sm:col-span-2 lg:col-span-3">{message}</p></form>;
}
export function SupplierBillingForm({period,value}:{period:string;value?:SupplierBilling}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={async e=>{
  e.preventDefault();const form=new FormData(e.currentTarget);setBusy(true);
  try{const result=await saveSupplierBilling(form);setMessage(result.error??result.success??'');}catch{setMessage('Enregistrement impossible');}finally{setBusy(false);}
 }}>
 <input type="hidden" name="period" value={period.slice(0,7)}/>
 <Field label="Appel officiel reçu le"><Input type="date" name="call_received_at" defaultValue={value?.call_received_at??''}/></Field>
 <label className="flex items-center gap-2 self-center text-sm"><input type="checkbox" name="invoiced" defaultChecked={value?.invoiced??false}/>Facture transmise à MEGA</label>
 <Field label="Date de facture (si connue)"><Input type="date" name="invoiced_at" defaultValue={value?.invoiced_at??''}/></Field>
 <Field label="Référence de facture"><Input name="invoice_reference" defaultValue={value?.invoice_reference??''}/></Field>
 <Field label="Encaissement confirmé (€)"><Input type="number" min="0" step="0.01" name="received" defaultValue={(value?.received_cents??0)/100}/></Field>
 <Field label="Date d’encaissement"><Input type="date" name="received_at" defaultValue={value?.received_at??''}/></Field>
 <Field label="Notes / justificatif"><Input name="notes" defaultValue={value?.notes??''}/></Field>
 <Button disabled={busy} className="self-end">Enregistrer le suivi MEGA</Button><p role="status" className="text-sm sm:col-span-2 lg:col-span-3">{message}</p></form>;
}
