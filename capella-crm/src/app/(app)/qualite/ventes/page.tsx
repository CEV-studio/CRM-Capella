import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { loadBelgiumProduction } from '@/lib/belgium/server';
import { norm } from '@/lib/belgium/domain';
import { createClient } from '@/lib/supabase/server';
import { isQualityEligibleSale } from '@/lib/quality';
import type { QualityReview } from '@/lib/domain/database.types';

export const dynamic='force-dynamic';
export const metadata={title:'Appels et contrôles qualité — Capella CRM'};
type ReviewRow=Pick<QualityReview,'id'|'sale_key'|'sale_reference'|'client_key'|'status'|'score_percent'|'controller_name'|'agent_name'|'agent_centre'|'reviewed_at'>;

export default async function QualitySalesPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;page?:string;vue?:string;agent?:string;centre?:string}>}){
 const profile=await requireProfile();
 if(!['admin','qualite'].includes(profile.role))redirect('/?motif=acces-refuse');
 const params=await searchParams;
 const completed=params.vue==='effectues';
 const {contracts}=await loadBelgiumProduction();
 const byKey=new Map(contracts.map(c=>[c.key,c]));
 const db=await createClient();
 const reviews:ReviewRow[]=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await db.from('quality_reviews')
   .select('id,sale_key,sale_reference,client_key,status,score_percent,controller_name,agent_name,agent_centre,reviewed_at')
   .order('reviewed_at',{ascending:false}).range(offset,offset+999);
  if(error)throw new Error('Lecture des contrôles impossible.');
  reviews.push(...(data||[]) as ReviewRow[]);
  if(!data||data.length<1000)break;
 }
 const reviewedKeys=new Set(reviews.flatMap(r=>[r.sale_key,r.sale_reference].filter((key):key is string=>!!key)));
 const search=norm(params.q||'');
 const remainingCandidates=contracts.filter(c=>c.supplier==='MEGA'&&['Elec','Gaz'].includes(c.energy)&&isQualityEligibleSale(c.status_class)&&!reviewedKeys.has(c.key))
  .filter(c=>(!params.status||c.status_class===params.status)&&(!params.centre||norm(c.centre)===norm(params.centre))&&(!params.agent||[c.agent,c.agent_reference].some(value=>norm(value||'')===norm(params.agent!)))&&(!search||norm([c.client,c.mega_id,c.reference,c.ean,c.agent,c.agent_reference,c.centre,c.key].join(' ')).includes(search)));
 const remaining=remainingCandidates.sort((a,b)=>(b.registered_date||'').localeCompare(a.registered_date||'')||a.client.localeCompare(b.client,'fr')||a.key.localeCompare(b.key));
 const completedRows=reviews.filter(r=>{
  const sale=byKey.get(r.sale_key||'')||byKey.get(r.sale_reference);
  if(params.centre&&norm(sale?.centre||r.agent_centre||'')!==norm(params.centre))return false;
  if(params.agent&&![sale?.agent,sale?.agent_reference,r.agent_name].some(value=>norm(value||'')===norm(params.agent!)))return false;
  if(!search)return true;
  return norm([sale?.client,sale?.mega_id,sale?.reference,sale?.ean,sale?.agent,sale?.centre,r.agent_name,r.agent_centre,r.sale_reference,r.sale_key,r.controller_name].join(' ')).includes(search);
 });
 const rows=completed?completedRows:remaining;
 const pages=Math.max(1,Math.ceil(rows.length/30));
 const page=Math.max(1,Math.min(pages,Math.floor(Number(params.page)||1)));
 const visible=rows.slice((page-1)*30,page*30);
 const url=(extra:Record<string,string>)=>'/qualite/ventes?'+new URLSearchParams({vue:completed?'effectues':'a_controler',q:params.q||'',agent:params.agent||'',centre:params.centre||'',...(completed?{}:{status:params.status||''}),...extra});
 return <main className="mx-auto max-w-6xl space-y-5 px-6 py-8">
  <Link href="/qualite" className="text-sm text-star-600 underline">← Tableau qualité</Link>
  <header><h1 className="font-display text-2xl font-bold text-navy-900">Contrôles qualité</h1></header>
  <nav aria-label="Listes des contrôles" className="flex flex-wrap gap-2 border-b border-navy-100 pb-4">
   <Link href={url({vue:'a_controler',page:'1'})} aria-current={!completed?'page':undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${!completed?'bg-navy-800 text-white':'border border-navy-200 bg-white'}`}>À contrôler · {remaining.length}</Link>
   <Link href={url({vue:'effectues',page:'1'})} aria-current={completed?'page':undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${completed?'bg-navy-800 text-white':'border border-navy-200 bg-white'}`}>Contrôles effectués · {completedRows.length}</Link>
  </nav>
  <section className="rounded-xl border border-navy-100 bg-white">
   <form className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_180px_auto]">
    <input type="hidden" name="vue" value={completed?'effectues':'a_controler'}/>
    <label className="text-sm">Client, agent, ID MEGA, EAN ou référence<input name="q" defaultValue={params.q} placeholder="Rechercher" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2"/></label>
    <label className="text-sm">Agent<input name="agent" defaultValue={params.agent} placeholder="Nom ou référence" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2"/></label>
    <label className="text-sm">Centre<select name="centre" defaultValue={params.centre||''} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2"><option value="">Tous les centres</option>{[...new Set(contracts.map(c=>c.centre))].filter(Boolean).sort().map(centre=><option key={centre}>{centre}</option>)}</select></label>
    {!completed&&<label className="text-sm">Statut de la vente<select name="status" defaultValue={params.status||''} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2"><option value="">Tous les statuts</option><option value="Signé">Signé</option><option value="Effectif">Effectif</option><option value="Salle d’attente">Salle d’attente</option></select></label>}
    <button className="self-end rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">Rechercher</button>
   </form>
   <div className="divide-y divide-navy-100">
    {completed?(visible as ReviewRow[]).map(r=>{
     const sale=byKey.get(r.sale_key||'')||byKey.get(r.sale_reference);
     const clientKey=r.client_key||sale?.client_id||sale?.mega_id||sale?.key;
     return <article key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div><div className="font-semibold text-navy-900">{sale?.client||r.sale_reference} <span className="ml-2 rounded bg-sky-50 px-2 py-1 text-xs text-sky-900">{Number(r.score_percent).toFixed(1)} % · {r.status}</span></div>
       <p className="mt-1 text-sm text-grey-brand">{sale?.energy||'Vente historique'} · Agent {r.agent_name} · {r.agent_centre||sale?.centre||'—'} · {r.sale_reference}</p>
       <p className="mt-1 text-xs text-grey-brand">Contrôlé le {new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(r.reviewed_at))} par {r.controller_name}</p>
      </div>
      <div className="flex flex-wrap gap-2">{clientKey&&<Link href={'/belgique?'+new URLSearchParams({tab:'clients',client:clientKey})} className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-semibold">Fiche client</Link>}<Link href={'/qualite/'+r.id} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">Voir le contrôle</Link></div>
     </article>;
    }):(visible as typeof remaining).map(c=><article key={c.key} className="flex flex-wrap items-center justify-between gap-4 p-4">
     <div><div className="font-semibold text-navy-900">{c.client||'Client sans nom'} <span className="ml-2 rounded bg-sky-50 px-2 py-1 text-xs text-sky-900">{c.status_class}</span></div>
      <p className="mt-1 text-sm text-grey-brand">{c.energy} · Agent {c.agent} · Réf. centre {c.agent_reference||'—'} · ID MEGA {c.mega_id||'—'} · {c.reference||c.ean||c.key}</p>
      <p className="mt-1 text-xs text-grey-brand">Inscription : {c.registered_date||'—'} · Centre : {c.centre}</p></div>
     <Link href={'/qualite/nouveau?sale='+encodeURIComponent(c.key)} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">Contrôler l’appel</Link>
    </article>)}
    {!visible.length&&<p className="p-6 text-sm text-grey-brand">{completed?'Aucun contrôle effectué dans cette vue.':'Aucun appel en attente de contrôle dans cette vue.'}</p>}
   </div>
   <div className="flex items-center justify-between border-t p-4 text-sm"><Link href={url({page:String(Math.max(1,page-1))})} aria-disabled={page===1} className={page===1?'pointer-events-none text-grey-brand':'underline'}>Précédent</Link><span>{rows.length} {completed?'contrôles':'ventes'} · page {page} / {pages}</span><Link href={url({page:String(Math.min(pages,page+1))})} aria-disabled={page===pages} className={page===pages?'pointer-events-none text-grey-brand':'underline'}>Suivant</Link></div>
  </section>
 </main>;
}
