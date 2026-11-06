'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type Mentionable = {id:string;full_name:string;role:string};
const control='mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm';

function MentionPicker({people,selected,onChange}:{people:Mentionable[];selected:string[];onChange:(ids:string[])=>void}){
 const [query,setQuery]=useState('');
 const matches=people.filter(p=>!selected.includes(p.id)&&p.full_name.toLocaleLowerCase('fr').includes(query.replace(/^@/,'').toLocaleLowerCase('fr'))).slice(0,8);
 return <div className="space-y-2"><label className="block text-sm">Notifier une personne<input aria-label="Mentionner une personne" value={query} onChange={e=>setQuery(e.target.value)} placeholder="@Nom ou prénom" className={control}/></label>
  {query.trim()&&<div className="max-h-44 overflow-y-auto rounded-lg border border-navy-200 bg-white">{matches.map(p=><button key={p.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-sky-50" onClick={()=>{onChange([...selected,p.id]);setQuery('');}}>@{p.full_name} <span className="text-grey-brand">· {p.role}</span></button>)}{!matches.length&&<p className="p-3 text-sm text-grey-brand">Aucune personne trouvée.</p>}</div>}
  {!!selected.length&&<div className="flex flex-wrap gap-2">{selected.map(id=>{const person=people.find(p=>p.id===id);return person?<button key={id} type="button" aria-label={`Retirer ${person.full_name}`} onClick={()=>onChange(selected.filter(x=>x!==id))} className="rounded-full bg-sky-50 px-3 py-1 text-sm text-navy-900">@{person.full_name} ×</button>:null;})}</div>}
 </div>;
}

export function IncidentForm({saleKey='',clientName='',people}:{saleKey?:string;clientName?:string;people:Mentionable[]}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [mentions,setMentions]=useState<string[]>([]);
 return <form className="space-y-4 rounded-xl border border-navy-100 bg-white p-5" onSubmit={async e=>{
  e.preventDefault();setBusy(true);setError('');const values=new FormData(e.currentTarget);
  try{const response=await fetch('/api/qualite/signalements',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...Object.fromEntries(values),mentioned_ids:mentions})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Enregistrement impossible.');window.dispatchEvent(new Event('crm-notifications-changed'));router.push(`/qualite/signalements/${result.id}`);router.refresh();}
  catch(err){setError(err instanceof Error?err.message:'Enregistrement impossible.');}finally{setBusy(false);}
 }}>
  <h2 className="font-semibold text-navy-900">Nouveau signalement</h2>
  {saleKey?<p className="rounded-lg bg-sky-50 p-3 text-sm">Vente liée : {clientName||saleKey}</p>:<label className="block text-sm">Client concerné (facultatif)<input name="client_name" maxLength={160} className={control}/></label>}
  <input type="hidden" name="sale_key" value={saleKey}/>
  <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Type<select name="category" className={control}><option value="ecart_contrat">Écart contrat / appel</option><option value="controle_a_refaire">Contrôle à refaire</option><option value="autre">Autre</option></select></label><label className="block text-sm">Objet<input name="title" required maxLength={180} placeholder="Ex. Gaz souscrit mais non évoqué" className={control}/></label></div>
  <label className="block text-sm">Constat et action attendue<textarea name="description" required maxLength={10000} rows={4} className={control}/></label>
  <MentionPicker people={people} selected={mentions} onChange={setMentions}/>
  {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
  <button disabled={busy} className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?'Enregistrement…':'Signaler'}</button>
 </form>;
}

export function IncidentCommentForm({id,people}:{id:string;people:Mentionable[]}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [mentions,setMentions]=useState<string[]>([]);
 return <form className="space-y-3 rounded-xl border border-navy-100 bg-white p-5" onSubmit={async e=>{
  e.preventDefault();const form=e.currentTarget;const body=new FormData(form).get('body');setBusy(true);setError('');
  try{const response=await fetch(`/api/qualite/signalements/${id}/commentaires`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body,mentioned_ids:mentions})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Commentaire non enregistré.');form.reset();setMentions([]);window.dispatchEvent(new Event('crm-notifications-changed'));router.refresh();}
  catch(err){setError(err instanceof Error?err.message:'Commentaire non enregistré.');}finally{setBusy(false);}
 }}><h2 className="font-semibold">Ajouter un commentaire</h2><textarea name="body" required maxLength={5000} rows={3} className={control} aria-label="Commentaire"/><MentionPicker people={people} selected={mentions} onChange={setMentions}/>{error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}<button disabled={busy} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Envoi…':'Publier'}</button></form>;
}

export function IncidentStatus({id,status}:{id:string;status:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 return <label className="block text-sm font-medium">Suivi<select value={status} disabled={busy} className={control} onChange={async e=>{
  setBusy(true);setError('');try{const response=await fetch(`/api/qualite/signalements/${id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status:e.target.value})});if(!response.ok)throw new Error('Mise à jour impossible.');router.refresh();}catch(err){setError(err instanceof Error?err.message:'Mise à jour impossible.');}finally{setBusy(false);}
 }}><option value="ouvert">À traiter</option><option value="en_cours">En cours</option><option value="resolu">Résolu</option></select>{error&&<span role="alert" className="block text-rose-700">{error}</span>}</label>;
}
