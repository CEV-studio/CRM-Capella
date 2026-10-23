'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {Dossier,Meter,Quote} from '@/lib/partners/types';
import {createClient} from '@/lib/supabase/client';
import {BUCKET_PIECES,cheminPiece,TAILLE_MAX,mimeAutorise} from '@/lib/supabase/storage';
export const inputClass='mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm';
const buttonClass='rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const emptyMeter=():Meter=>({energy_type:'electricite',identifier:'',contract_expiry:'',address:'',postal_code:'',city:''});
async function command(action:string,id:string,data:Record<string,unknown>={}){
 const r=await fetch('/api/partenaires/commandes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,id,data})});
 const result=await r.json();if(!r.ok)throw new Error(result.error||'Enregistrement impossible');return result;
}
function Feedback({text}:{text:string}){return text?<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-navy-900">{text}</p>:null;}
export function Field({label,...props}:React.InputHTMLAttributes<HTMLInputElement>&{label:string}){return <label className="block text-sm text-navy-700">{label}<input {...props} className={inputClass}/></label>;}
function MeterFields({meters,setMeters,full=false}:{meters:Meter[];setMeters:(m:Meter[])=>void;full?:boolean}){
 const update=(i:number,key:keyof Meter,value:string)=>setMeters(meters.map((m,n)=>n===i?{...m,[key]:value}:m));
 return <section className="space-y-3"><h2 className="font-semibold">Compteurs — PDL / PCE</h2>{meters.map((m,i)=><div key={i} className="grid gap-3 rounded-xl border border-navy-100 bg-navy-50 p-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm">Énergie<select className={inputClass} value={m.energy_type} onChange={e=>update(i,'energy_type',e.target.value)}><option value="electricite">Électricité</option><option value="gaz">Gaz</option></select></label><Field label={m.energy_type==='electricite'?'PDL *':'PCE *'} required pattern="[0-9]{14}" maxLength={14} value={m.identifier} onChange={e=>update(i,'identifier',e.target.value.replace(/\D/g,''))}/>{full?<><Field label="Fin du contrat actuel *" type="date" required value={m.contract_expiry} onChange={e=>update(i,'contract_expiry',e.target.value)}/><Field label="Adresse du compteur *" required value={m.address} onChange={e=>update(i,'address',e.target.value)}/><Field label="Code postal *" pattern="[0-9]{5}" required value={m.postal_code} onChange={e=>update(i,'postal_code',e.target.value)}/><Field label="Ville *" required value={m.city} onChange={e=>update(i,'city',e.target.value)}/></>:null}<button type="button" disabled={meters.length===1} onClick={()=>setMeters(meters.filter((_,n)=>n!==i))} className="text-left text-xs text-red-700 disabled:opacity-30">Retirer ce compteur</button></div>)}<button type="button" className="rounded-lg border border-navy-200 px-3 py-2 text-sm" onClick={()=>setMeters([...meters,emptyMeter()])}>+ Ajouter un compteur</button></section>;
}
async function uploadFiles(prospectId:string,files:File[],type:'Facture'|'ACD'|'Contrat'|'Offre'){
 const db=createClient();
 for(const file of files){
  if(file.size>TAILLE_MAX||!mimeAutorise(file.type))throw new Error(`${file.name} : PDF, JPG ou PNG, 10 Mo maximum.`);
 }
 for(const file of files){
  const path=cheminPiece('prospect',prospectId,file.name);
  const {error}=await db.storage.from(BUCKET_PIECES).upload(path,file,{contentType:file.type,upsert:false});if(error)throw new Error(error.message);
  const {error:insertError}=await db.from('pieces_jointes').insert({type,prospect_id:prospectId,bucket_path:path,file_name:file.name,mime:file.type,taille:file.size});
  if(insertError){await db.storage.from(BUCKET_PIECES).remove([path]);throw new Error(insertError.message);}
 }
}
export function OpportunityForm({dossier}:{dossier?:Dossier}){
 const router=useRouter();const [id]=useState(()=>dossier?.id??crypto.randomUUID());
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(Object.entries(dossier?.details??{}).filter(([,v])=>typeof v==='string')) as Record<string,string>);
 const [meters,setMeters]=useState<Meter[]>(dossier?.details.meters?.length?dossier.details.meters:[emptyMeter()]);
 const [busy,setBusy]=useState(false),[lookup,setLookup]=useState(false),[status,setStatus]=useState('');
 const [created,setCreated]=useState<Dossier|undefined>(dossier);const [uploaded,setUploaded]=useState(false);
 const set=(name:string,value:string)=>setValues(v=>({...v,[name]:value}));
 async function search(){setLookup(true);setStatus('');try{const r=await fetch(`/api/partenaires/entreprise?siret=${values.siret??''}`);const data=await r.json();if(!r.ok)throw new Error(data.error);setValues(v=>({...v,...data}));}catch(e){setStatus((e as Error).message);}finally{setLookup(false);}}
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget;setBusy(true);setStatus('');
  try{
   const files=(new FormData(form).getAll('factures') as File[]).filter(f=>f.size>0);
   if(!created&&!files.length)throw new Error('Ajoutez au moins une facture.');
   const data={...values,signatory_capacity:values.signatory_capacity||'representant_legal',meters};
   let current=created;
   if(!current){await command('draft',id,data);const db=createClient();const result=await db.from('partner_dossiers').select('*').eq('id',id).single();if(result.error)throw result.error;current=result.data;setCreated(current);}
   if(!uploaded&&files.length){await uploadFiles(current.prospect_id,files,'Facture');setUploaded(true);}
   const result=await command('submit',id,data);
   router.push(`/partenaires/dossiers/${id}${result.email?.failed?'?alerte=email':''}`);router.refresh();
  }catch(e){setStatus((e as Error).message);}finally{setBusy(false);}
 }
 const fields=[['raison_sociale','Raison sociale *'],['company_address','Adresse du siège *'],['company_postal_code','Code postal *'],['company_city','Ville *'],['signatory_first_name','Prénom du signataire *'],['signatory_last_name','Nom du signataire *'],['signatory_email','Email du signataire *'],['signatory_phone','Téléphone *'],['signatory_role','Fonction du signataire *']];
 return <form onSubmit={submit} className="space-y-6 rounded-2xl border border-navy-100 bg-white p-6"><div className="flex items-end gap-3"><div className="flex-1"><Field label="SIRET *" required pattern="[0-9]{14}" maxLength={14} value={values.siret??''} onChange={e=>set('siret',e.target.value.replace(/\D/g,''))}/></div><button type="button" disabled={lookup} className={buttonClass} onClick={search}>{lookup?'Recherche…':'Rechercher'}</button></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([name,label])=><Field key={name} name={name} label={label} required type={name==='signatory_email'?'email':'text'} pattern={name==='company_postal_code'?'[0-9]{5}':undefined} value={values[name]??''} onChange={e=>set(name,e.target.value)}/>)}<label className="text-sm">Qualité du signataire<select className={inputClass} value={values.signatory_capacity??'representant_legal'} onChange={e=>set('signatory_capacity',e.target.value)}><option value="representant_legal">Représentant légal</option><option value="mandataire">Mandataire</option></select></label></div><MeterFields full meters={meters} setMeters={setMeters}/><Field label="Facture(s) — PDF, JPG, PNG, 10 Mo par fichier" type="file" name="factures" multiple accept="application/pdf,image/png,image/jpeg" required={!created} onChange={()=>setUploaded(false)}/><label className="block text-sm">Commentaire<textarea className={inputClass} value={values.notes??''} onChange={e=>set('notes',e.target.value)}/></label><Feedback text={status}/><button disabled={busy} className={buttonClass}>{busy?'Enregistrement…':'Créer le dossier et demander l’ACD'}</button></form>;
}
export function QuoteForm({dossier}:{dossier:Dossier}){
 const router=useRouter();const [meters,setMeters]=useState<Meter[]>(dossier.details.meters?.length?dossier.details.meters:[emptyMeter()]);
 const [key,setKey]=useState(()=>crypto.randomUUID());const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setBusy(true);setStatus('');try{
  await command('quote',dossier.id,{request_key:key,start_date:f.get('start_date'),end_date:f.get('end_date'),quote_date:f.get('quote_date'),comment:f.get('comment'),is_regie:f.has('is_regie'),offer_market:f.has('offer_market'),offer_other:f.has('offer_other'),meters});
  setKey(crypto.randomUUID());setStatus('Demande transmise à l’ADV.');form.reset();router.push(`/partenaires/dossiers/${dossier.id}?onglet=cotations`);router.refresh();
 }catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}
 return <form onSubmit={submit} className="space-y-5 rounded-xl border border-navy-100 bg-white p-5"><h2 className="font-semibold">Nouvelle demande de cotation</h2><div className="grid gap-4 sm:grid-cols-3"><Field label="Début du nouveau contrat *" name="start_date" type="date" required/><Field label="Fin du nouveau contrat *" name="end_date" type="date" required/><Field label="Date de cotation souhaitée *" name="quote_date" type="date" required/></div><MeterFields meters={meters} setMeters={setMeters}/><div className="flex flex-wrap gap-5">{[['is_regie','Régie'],['offer_market','Marché'],['offer_other','Autre']].map(([name,label])=><label key={name} className="flex items-center gap-2 text-sm"><input type="checkbox" name={name}/>{label}</label>)}</div><label className="block text-sm">Commentaire *<textarea required maxLength={5000} name="comment" className={inputClass}/></label><Feedback text={status}/><button disabled={busy} className={buttonClass}>{busy?'Envoi…':'Demander une cotation'}</button></form>;
}
export function ResendAcd({id}:{id:string}){const [busy,setBusy]=useState(false),[status,setStatus]=useState('');return <div className="space-y-2"><button className={buttonClass} disabled={busy} onClick={async()=>{setBusy(true);try{await command('resend',id);setStatus('Demande de renvoi transmise.');}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}}>Demander le renvoi de l’ACD</button><Feedback text={status}/></div>;}
export function MessageForm({id,quotes}:{id:string;quotes:Quote[]}){
 const router=useRouter();const [kind,setKind]=useState('message'),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 return <form className="space-y-3" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setBusy(true);try{await command('message',id,{kind,quote_id:f.get('quote_id'),body:f.get('body')});form.reset();setStatus('Message transmis.');router.refresh();}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}}><label className="block text-sm">Objet<select className={inputClass} value={kind} onChange={e=>setKind(e.target.value)}><option value="message">Message sur le dossier</option><option value="contrat">Demander l’envoi du contrat</option></select></label><label className="block text-sm">Cotation concernée<select name="quote_id" required={kind==='contrat'} className={inputClass}><option value="">Sélectionner une cotation</option>{quotes.map(q=><option key={q.id} value={q.id}>{q.start_date} → {q.end_date} · {q.meters.map(m=>m.identifier).join(', ')}</option>)}</select></label><textarea name="body" required maxLength={5000} aria-label="Message" placeholder="Précisez l’offre retenue et les informations utiles…" className={inputClass}/><Feedback text={status}/><button className={buttonClass} disabled={busy}>{busy?'Envoi…':'Envoyer le message'}</button></form>;
}
export function DocumentForm({prospectId,dossierId,admin=false}:{prospectId:string;dossierId:string;admin?:boolean}){
 const router=useRouter();const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
 return <form className="flex flex-wrap items-end gap-3" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setBusy(true);try{await uploadFiles(prospectId,(f.getAll('files') as File[]).filter(f=>f.size>0),f.get('type') as 'Facture'|'ACD'|'Contrat'|'Offre');if(admin)await command('documents',dossierId);form.reset();setStatus('Documents ajoutés.');router.refresh();}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}}><label className="text-sm">Type de document<select name="type" className={inputClass}><option>Facture</option><option>ACD</option><option>Contrat</option>{admin?<option>Offre</option>:null}</select></label><Field label="Fichiers" type="file" name="files" multiple required accept="application/pdf,image/png,image/jpeg"/><button className={buttonClass} disabled={busy}>Ajouter</button><Feedback text={status}/></form>;
}
export function NotificationActions({id,retry=false}:{id?:string;retry?:boolean}){
 const router=useRouter();const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 return <div><button disabled={busy} className="text-sm underline" onClick={async()=>{setBusy(true);try{if(retry){const r=await fetch('/api/partenaires/notifications',{method:'POST'});if(!r.ok)throw new Error('Relance impossible');const d=await r.json();setStatus(`${d.sent} envoyé(s), ${d.failed} échec(s).`);}else if(id){const r=await fetch('/api/notifications/lire',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw new Error('Mise à jour impossible');}router.refresh();}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}}>{busy?'…':retry?'Relancer les mails en échec':'Marquer comme lu'}</button><Feedback text={status}/></div>;
}
