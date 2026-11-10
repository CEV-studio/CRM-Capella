import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadBelgiumProduction } from '@/lib/belgium/server';
import { norm } from '@/lib/belgium/domain';
import { isQualityEligibleSale } from '@/lib/quality';
import type { QualityReview } from '@/lib/domain/database.types';

export const dynamic='force-dynamic';
export const metadata={title:'Ventes et contrôles d’un agent — Capella CRM'};
type Review=Pick<QualityReview,'id'|'sale_key'|'sale_reference'|'agent_name'|'agent_centre'|'score_percent'|'reviewed_at'|'controller_name'>;

export default async function AgentSales({searchParams}:{searchParams:Promise<{ref?:string;name?:string;centre?:string;vue?:string;page?:string}>}){
 const profile=await requireProfile();
 if(!['admin','qualite'].includes(profile.role))redirect('/?motif=acces-refuse');
 const params=await searchParams;
 const ref=(params.ref||'').trim(),name=(params.name||'').trim(),centre=(params.centre||'').trim();
 if(!ref||ref.length>120||centre.length>120||name.length>120)redirect('/qualite/agents');
 const {contracts}=await loadBelgiumProduction();
 const matches=(value:string|undefined)=>!!value&&[ref,name].some(candidate=>candidate&&norm(value)===norm(candidate));
 const sales=contracts.filter(c=>(!centre||norm(c.centre)===norm(centre))&&(matches(c.agent)||matches(c.agent_reference)))
  .sort((a,b)=>(b.registered_date||'').localeCompare(a.registered_date||'')||a.client.localeCompare(b.client,'fr')||a.key.localeCompare(b.key));
 const db=await createClient();const allReviews:Review[]=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await db.from('quality_reviews').select('id,sale_key,sale_reference,agent_name,agent_centre,score_percent,reviewed_at,controller_name').order('reviewed_at',{ascending:false}).range(offset,offset+999);
  if(error)throw new Error('Lecture des contrôles impossible.');
  allReviews.push(...(data||[]) as Review[]);
  if(!data||data.length<1000)break;
 }
 const saleKeys=new Set(sales.map(s=>s.key));
 const reviews=allReviews.filter(r=>saleKeys.has(r.sale_key||'')||saleKeys.has(r.sale_reference)||matches(r.agent_name)&&(!centre||norm(r.agent_centre||'')===norm(centre)));
 const bySale=new Map<string,Review[]>();
 for(const review of reviews)for(const key of new Set([review.sale_key,review.sale_reference].filter((key):key is string=>!!key)))bySale.set(key,[...(bySale.get(key)||[]),review]);
 const reviewedKeys=new Set(reviews.flatMap(r=>[r.sale_key,r.sale_reference].filter((key):key is string=>!!key)));
 const eligible=(s:typeof sales[number])=>s.supplier==='MEGA'&&['Elec','Gaz'].includes(s.energy)&&isQualityEligibleSale(s.status_class);
 const pendingSales=sales.filter(s=>eligible(s)&&!reviewedKeys.has(s.key));
 const completedSales=sales.filter(s=>reviewedKeys.has(s.key));
 const view=params.vue==='controles'?'controles':params.vue==='toutes'?'toutes':'a_controler';
 const filtered=view==='controles'?completedSales:view==='toutes'?sales:pendingSales;
 const pages=Math.max(1,Math.ceil(filtered.length/30));
 const page=Math.max(1,Math.min(pages,Math.floor(Number(params.page)||1)));
 const visible=filtered.slice((page-1)*30,page*30);
 const href=(extra:Record<string,string>)=>'/qualite/agents/ventes?'+new URLSearchParams({ref,name,centre,vue:view,...extra});
 const orphanReviews=reviews.filter(r=>!saleKeys.has(r.sale_key||'')&&!saleKeys.has(r.sale_reference));
 return <main className="mx-auto max-w-6xl space-y-5 px-6 py-8">
  <header><Link href="/qualite/agents" className="text-sm text-star-600 underline">← Qualité par agent</Link><h1 className="mt-2 font-display text-2xl font-bold text-navy-900">{name||ref}</h1><p className="text-sm text-grey-brand">{centre||'Centre non renseigné'} · {ref} · {sales.length} ventes · {reviews.length} contrôles</p></header>
  <nav aria-label="Ventes de l’agent" className="flex flex-wrap gap-2 border-b border-navy-100 pb-4">
   <Link href={href({vue:'a_controler',page:'1'})} aria-current={view==='a_controler'?'page':undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view==='a_controler'?'bg-navy-800 text-white':'border border-navy-200 bg-white'}`}>À contrôler · {pendingSales.length}</Link>
   <Link href={href({vue:'controles',page:'1'})} aria-current={view==='controles'?'page':undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view==='controles'?'bg-navy-800 text-white':'border border-navy-200 bg-white'}`}>Déjà contrôlées · {completedSales.length}</Link>
   <Link href={href({vue:'toutes',page:'1'})} aria-current={view==='toutes'?'page':undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view==='toutes'?'bg-navy-800 text-white':'border border-navy-200 bg-white'}`}>Toutes les ventes · {sales.length}</Link>
  </nav>
  <section className="divide-y divide-navy-100 rounded-xl border border-navy-100 bg-white">{visible.map(s=>{
   const controls=bySale.get(s.key)||[];
   const clientKey=s.client_id||s.mega_id||s.key;
   return <article key={s.key} className="flex flex-wrap items-start justify-between gap-4 p-4"><div className="min-w-0 space-y-1"><h2 className="font-semibold text-navy-900">{s.client||'Client sans nom'} <span className="rounded bg-sky-50 px-2 py-1 text-xs text-sky-900">{s.status_class}</span></h2><p className="text-sm text-grey-brand">{s.supplier} · {s.energy} · {s.reference||s.ean||s.mega_id||s.key}</p><p className="text-xs text-grey-brand">Inscription : {s.registered_date||'—'} · {controls.length} contrôle{controls.length>1?'s':''}</p>{controls.map(r=><Link key={r.id} href={'/qualite/'+r.id} className="mr-3 inline-block text-sm font-semibold text-star-600 underline">Contrôle du {new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(r.reviewed_at))} · {Number(r.score_percent).toFixed(1)} %</Link>)}</div><div className="flex flex-wrap gap-2"><Link href={'/belgique?'+new URLSearchParams({tab:'clients',client:clientKey})} className="rounded-lg border border-navy-200 px-3 py-2 text-sm font-semibold">Fiche client</Link>{eligible(s)&&<Link href={'/qualite/nouveau?sale='+encodeURIComponent(s.key)} className="rounded-lg bg-navy-800 px-3 py-2 text-sm font-semibold text-white">{controls.length?'Nouveau contrôle':'Contrôler l’appel'}</Link>}</div></article>;
  })}{!visible.length&&<p className="p-5 text-sm text-grey-brand">Aucune vente dans cette vue.</p>}</section>
 {view!=='a_controler'&&orphanReviews.length>0&&<section className="rounded-xl border border-navy-100 bg-white p-5"><h2 className="font-semibold">Contrôles historiques sans vente active</h2><div className="mt-3 flex flex-wrap gap-3">{orphanReviews.map(r=><Link key={r.id} href={'/qualite/'+r.id} className="text-sm font-semibold text-star-600 underline">{r.sale_reference} · {Number(r.score_percent).toFixed(1)} %</Link>)}</div></section>}
  {pages>1&&<nav aria-label="Pages des ventes" className="flex justify-between text-sm"><span>Page {page} / {pages}</span><div className="flex gap-4">{page>1&&<Link href={href({page:String(page-1)})} className="underline">Précédent</Link>}{page<pages&&<Link href={href({page:String(page+1)})} className="underline">Suivant</Link>}</div></nav>}
 </main>;
}
