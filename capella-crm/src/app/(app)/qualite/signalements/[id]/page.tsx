import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { IncidentCommentForm,IncidentStatus } from '../incident-actions';

export const dynamic='force-dynamic';
export default async function QualityIncidentDetail({params}:{params:Promise<{id:string}>}){
 const profile=await requireProfile();
 const {id}=await params;const db=await createClient();
 const {data:item,error}=await db.from('quality_incidents').select('*').eq('id',id).maybeSingle();
 if(error)throw new Error(error.message);if(!item)notFound();
 const [{data:comments,error:commentsError},{data:people,error:peopleError}]=await Promise.all([
  db.from('quality_incident_comments').select('*').eq('incident_id',id).order('created_at',{ascending:true}),
  createAdminClient().from('profiles').select('id,full_name,role').eq('is_active',true).order('full_name')
 ]);
 if(commentsError||peopleError)throw new Error(commentsError?.message||peopleError?.message);
 const names=new Map((people||[]).map(p=>[p.id,p.full_name]));
 return <main className="mx-auto max-w-4xl space-y-5 px-6 py-8"><Link href="/qualite/signalements" className="text-sm text-star-600 underline">← Signalements qualité</Link><header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-2xl font-bold text-navy-900">{item.title}</h1><p className="mt-2 text-sm text-grey-brand">Signalé par {item.reporter_name} · {new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(item.reported_at))}</p></div>{profile.role==='admin'&&<IncidentStatus id={item.id} status={item.status}/>}</header>
  <article className="space-y-4 rounded-xl border border-navy-100 bg-white p-5"><div><span className="text-xs text-grey-brand">Client</span><p className="font-semibold">{item.client_name||'—'}</p></div><div><span className="text-xs text-grey-brand">Description</span><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.description}</p></div>{item.sale_key&&['admin','qualite'].includes(profile.role)&&<Link href={'/qualite/ventes?'+new URLSearchParams({q:item.sale_key})} className="inline-block text-sm font-semibold text-star-600 underline">Voir la vente concernée</Link>}{item.mentioned_ids.length>0&&<p className="text-sm text-grey-brand">Notifiés : {item.mentioned_ids.map(mention=>names.get(mention)).filter(Boolean).join(', ')}</p>}</article>
  <section className="space-y-3"><h2 className="font-semibold text-navy-900">Échanges</h2>{(comments||[]).map(comment=><article key={comment.id} className="rounded-xl border border-navy-100 bg-white p-4"><p className="text-sm font-semibold">{comment.author_name} <span className="font-normal text-grey-brand">· {new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(comment.created_at))}</span></p><p className="mt-2 whitespace-pre-wrap text-sm">{comment.body}</p>{comment.mentioned_ids.length>0&&<p className="mt-2 text-xs text-grey-brand">Notifiés : {comment.mentioned_ids.map(mention=>names.get(mention)).filter(Boolean).join(', ')}</p>}</article>)}{!comments?.length&&<p className="text-sm text-grey-brand">Aucun commentaire.</p>}</section>
  <IncidentCommentForm id={item.id} people={people||[]}/>
 </main>;
}
