import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadBelgiumProduction } from '@/lib/belgium/server';
import { IncidentForm,SyncQualityEmails } from './incident-actions';

export const dynamic='force-dynamic';
export const metadata={title:'Signalements qualité — Capella CRM'};
const labels:Record<string,string>={ouvert:'À traiter',en_cours:'En cours',resolu:'Résolu'};
export default async function QualityIncidentsPage({searchParams}:{searchParams:Promise<{sale?:string;status?:string}>}){
 const profile=await requireProfile();if(!['admin','qualite'].includes(profile.role))redirect('/?motif=acces-refuse');
 const {sale='',status=''}=await searchParams;
 const db=await createClient();
 let query=db.from('quality_incidents').select('*').order('reported_at',{ascending:false}).limit(200);
 if(['ouvert','en_cours','resolu'].includes(status))query=query.eq('status',status as 'ouvert'|'en_cours'|'resolu');
 const {data,error}=await query;if(error)throw new Error(`Signalements : ${error.message}`);
 let clientName='';
 if(sale){const production=await loadBelgiumProduction();clientName=production.contracts.find(c=>c.key===sale)?.client||'';}
 return <main className="mx-auto max-w-6xl space-y-5 px-6 py-8">
  <header className="flex flex-wrap items-end justify-between gap-3"><div><Link href="/qualite" className="text-sm text-star-600 underline">← Tableau qualité</Link><h1 className="mt-2 font-display text-2xl font-bold text-navy-900">Signalements qualité</h1></div>{profile.role==='admin'&&<SyncQualityEmails/>}</header>
  <IncidentForm saleKey={clientName?sale:''} clientName={clientName}/>
  <section className="rounded-xl border border-navy-100 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 p-4"><h2 className="font-semibold">Suivi des anomalies · {data?.length||0}</h2><nav className="flex gap-3 text-sm">{[['','Tous'],['ouvert','À traiter'],['en_cours','En cours'],['resolu','Résolus']].map(([value,label])=><Link key={value} href={'/qualite/signalements'+(value?`?status=${value}`:'')} className={status===value?'font-semibold text-navy-900 underline':'text-star-600'}>{label}</Link>)}</nav></div>
   <div className="divide-y divide-navy-100">{(data||[]).map(item=><Link key={item.id} href={`/qualite/signalements/${item.id}`} className="block p-4 hover:bg-sky-50"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-navy-900">{item.title}</strong><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status==='resolu'?'bg-emerald-50 text-emerald-800':item.status==='en_cours'?'bg-sky-50 text-sky-900':'bg-amber-50 text-amber-800'}`}>{labels[item.status]}</span></div><p className="mt-1 line-clamp-2 text-sm text-grey-brand">{item.description}</p><p className="mt-2 text-xs text-grey-brand">{item.reporter_name} · {item.client_name||'Sans vente liée'} · {new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(item.reported_at))} · {item.source==='email'?'Mail':'CRM'}</p></Link>)}{!data?.length&&<p className="p-5 text-sm text-grey-brand">Aucun signalement dans cette vue.</p>}</div>
  </section>
 </main>;
}
