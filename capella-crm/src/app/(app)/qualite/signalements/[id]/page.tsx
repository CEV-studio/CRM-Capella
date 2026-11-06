import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { IncidentStatus } from '../incident-actions';

export const dynamic='force-dynamic';
export default async function QualityIncidentDetail({params}:{params:Promise<{id:string}>}){
 const profile=await requireProfile();if(!['admin','qualite'].includes(profile.role))redirect('/?motif=acces-refuse');
 const {id}=await params;const db=await createClient();const {data:item,error}=await db.from('quality_incidents').select('*').eq('id',id).maybeSingle();if(error)throw new Error(error.message);if(!item)notFound();
 return <main className="mx-auto max-w-4xl space-y-5 px-6 py-8"><Link href="/qualite/signalements" className="text-sm text-star-600 underline">← Signalements qualité</Link><header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-2xl font-bold text-navy-900">{item.title}</h1><p className="mt-2 text-sm text-grey-brand">Signalé par {item.reporter_name} · {new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(item.reported_at))} · {item.source==='email'?'Mail':'CRM'}</p></div>{profile.role==='admin'&&<IncidentStatus id={item.id} status={item.status}/>}</header>
  <article className="space-y-4 rounded-xl border border-navy-100 bg-white p-5"><div><span className="text-xs text-grey-brand">Client</span><p className="font-semibold">{item.client_name||'—'}</p></div><div><span className="text-xs text-grey-brand">Description</span><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.description}</p></div>{item.sale_key&&<Link href={'/qualite/ventes?'+new URLSearchParams({q:item.sale_key})} className="inline-block text-sm font-semibold text-star-600 underline">Voir la vente concernée</Link>}{item.attachment_names.length>0&&<div><span className="text-xs text-grey-brand">Pièces jointes du mail</span><ul className="mt-1 list-inside list-disc text-sm">{item.attachment_names.map((name,index)=><li key={`${name}:${index}`}>{name}</li>)}</ul></div>}{item.source==='email'&&item.source_thread_id&&<p><a target="_blank" rel="noopener noreferrer" href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(item.source_thread_id)}`} className="text-sm font-semibold text-star-600 underline">Ouvrir le mail et ses pièces jointes</a></p>}</article>
 </main>;
}
