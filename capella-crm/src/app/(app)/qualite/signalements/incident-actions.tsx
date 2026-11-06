'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const control='mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm';
export function IncidentForm({saleKey='',clientName=''}:{saleKey?:string;clientName?:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 return <form className="space-y-4 rounded-xl border border-navy-100 bg-white p-5" onSubmit={async e=>{
  e.preventDefault();setBusy(true);setError('');const form=e.currentTarget;const values=new FormData(form);
  try{const response=await fetch('/api/qualite/signalements',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(values))});const result=await response.json();if(!response.ok)throw new Error(result.error||'Enregistrement impossible.');router.push(`/qualite/signalements/${result.id}`);router.refresh();}
  catch(err){setError(err instanceof Error?err.message:'Enregistrement impossible.');}finally{setBusy(false);}
 }}>
  <h2 className="font-semibold text-navy-900">Nouveau signalement</h2>
  {saleKey?<p className="rounded-lg bg-sky-50 p-3 text-sm">Vente liée : {clientName||saleKey}</p>:<label className="block text-sm">Client concerné (facultatif)<input name="client_name" maxLength={160} className={control}/></label>}
  <input type="hidden" name="sale_key" value={saleKey}/>
  <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Type<select name="category" className={control}><option value="ecart_contrat">Écart contrat / appel</option><option value="controle_a_refaire">Contrôle à refaire</option><option value="autre">Autre</option></select></label><label className="block text-sm">Objet<input name="title" required maxLength={180} placeholder="Ex. Gaz souscrit mais non évoqué" className={control}/></label></div>
  <label className="block text-sm">Constat et action attendue<textarea name="description" required maxLength={10000} rows={4} className={control}/></label>
  {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
  <button disabled={busy} className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?'Enregistrement…':'Signaler'}</button>
 </form>;
}

export function IncidentStatus({id,status}:{id:string;status:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 return <label className="block text-sm font-medium">Suivi<select value={status} disabled={busy} className={control} onChange={async e=>{
  setBusy(true);setError('');try{const response=await fetch(`/api/qualite/signalements/${id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status:e.target.value})});if(!response.ok)throw new Error('Mise à jour impossible.');router.refresh();}catch(err){setError(err instanceof Error?err.message:'Mise à jour impossible.');}finally{setBusy(false);}
 }}><option value="ouvert">À traiter</option><option value="en_cours">En cours</option><option value="resolu">Résolu</option></select>{error&&<span role="alert" className="block text-rose-700">{error}</span>}</label>;
}

export function SyncQualityEmails(){const router=useRouter();const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');return <button type="button" disabled={busy} className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm font-semibold" onClick={async()=>{setBusy(true);setStatus('');try{const response=await fetch('/api/qualite/signalements/email-sync',{method:'POST'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Synchronisation impossible.');setStatus(result.connected?`${result.imported} nouveau(x) rapport(s).`:'Aucune boîte Gmail connectée.');window.dispatchEvent(new Event('crm-notifications-changed'));router.refresh();}catch(err){setStatus(err instanceof Error?err.message:'Synchronisation impossible.');}finally{setBusy(false);}}}>{busy?'Synchronisation…':'Actualiser les mails qualité'}{status&&<span className="ml-2 text-xs font-normal">{status}</span>}</button>}
