import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { aggregateQualityScores, type QualityScoreRow } from '@/lib/quality';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Scores des agents — Capella CRM' };

const color = (score:number) => score >= 90
  ? { bar:'bg-emerald-500', badge:'bg-emerald-50 text-emerald-800' }
  : score >= 75
    ? { bar:'bg-amber-500', badge:'bg-amber-50 text-amber-800' }
    : { bar:'bg-rose-500', badge:'bg-rose-50 text-rose-800' };

export default async function AgentQualityScores({searchParams}:{searchParams:Promise<{q?:string}>}) {
 const profile=await requireProfile();
 if(!['admin','qualite'].includes(profile.role))redirect('/?motif=acces-refuse');
 const {q=''}=await searchParams;
 const db=await createClient();
 const rows:QualityScoreRow[]=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await db.from('quality_reviews')
   .select('id,activity_name,agent_name,sale_reference,score_percent')
   .order('reviewed_at',{ascending:false}).range(offset,offset+999);
  if(error)throw new Error(`Scores des agents : ${error.message}`);
  rows.push(...(data||[]));
  if(!data||data.length<1000)break;
 }
 const summaries=aggregateQualityScores(rows).agentSummaries;
 const query=q.trim().toLocaleLowerCase('fr-FR');
 const visible=summaries.filter(a=>a.agent.toLocaleLowerCase('fr-FR').includes(query));
 return <main className="mx-auto max-w-[1500px] space-y-6 px-6 py-8">
  <header className="flex flex-wrap items-end justify-between gap-3">
   <div><Link href="/qualite" className="text-sm text-star-600 underline">← Tableau qualité</Link><h1 className="mt-2 font-display text-2xl font-bold text-navy-900">Scores des agents</h1><p className="mt-1 text-sm text-grey-brand">{summaries.length} agent{summaries.length>1?'s':''} évalué{summaries.length>1?'s':''} · chaque vente compte une fois dans la moyenne.</p></div>
   <form className="flex gap-2"><label className="sr-only" htmlFor="agent-search">Rechercher un agent</label><input id="agent-search" name="q" defaultValue={q} placeholder="Rechercher un agent" className="h-10 rounded-lg border border-navy-200 bg-white px-3 text-sm"/><button className="rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white">Rechercher</button></form>
  </header>
  <section aria-label="Scores individuels" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
   {visible.map(a=>{const tone=color(a.score);return <Link key={a.agent.toLocaleLowerCase('fr-FR')} href={'/qualite?'+new URLSearchParams({agent:a.agent})} className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md">
    <div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words font-semibold text-navy-900">{a.agent}</h2><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>{a.score>=90?'Conforme':a.score>=75?'À consolider':'Insuffisant'}</span></div>
    <div className="mt-4 font-display text-4xl font-bold text-navy-900">{a.score.toFixed(1)} <span className="text-xl">%</span></div>
    <div role="img" aria-label={`Score ${a.score.toFixed(1)} %`} className="mt-3 h-2 overflow-hidden rounded-full bg-navy-100"><div className={`h-full rounded-full ${tone.bar}`} style={{width:`${Math.max(0,Math.min(100,a.score))}%`}}/></div>
    <div className="mt-3 flex items-center justify-between gap-2 text-sm text-grey-brand"><span>{a.sales} vente{a.sales>1?'s':''} contrôlée{a.sales>1?'s':''}</span><span className="font-semibold text-star-600">Voir les contrôles →</span></div>
   </Link>})}
  </section>
  {!summaries.length&&<p className="rounded-xl border border-navy-100 bg-white p-6 text-sm text-grey-brand">Les scores apparaîtront dès les premiers contrôles d’appels.</p>}
  {!!summaries.length&&!visible.length&&<p className="rounded-xl border border-navy-100 bg-white p-6 text-sm text-grey-brand">Aucun agent ne correspond à cette recherche.</p>}
 </main>;
}
