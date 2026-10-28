import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { loadBelgiumProduction } from '@/lib/belgium/server';
import { norm } from '@/lib/belgium/domain';
import { createClient } from '@/lib/supabase/server';
import { isQualityEligibleSale } from '@/lib/quality';

export const dynamic='force-dynamic';
export const metadata={title:'Appels à contrôler — Capella CRM'};
export default async function QualitySalesPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;page?:string}>}){
 const profile=await requireProfile();if(!['admin','qualite'].includes(profile.role))redirect('/?motif=acces-refuse');
 const params=await searchParams;
 const {contracts}=await loadBelgiumProduction();
 const eligible=contracts.filter(c=>c.supplier==='MEGA'&&['Elec','Gaz'].includes(c.energy)&&isQualityEligibleSale(c.status_class));
 const query=norm(params.q||'');
 const filtered=eligible.filter(c=>(!params.status||c.status_class===params.status)&&(!query||norm([c.client,c.mega_id,c.reference,c.ean,c.agent,c.agent_reference,c.centre,c.key].join(' ')).includes(query))).sort((a,b)=>(b.registered_date||'').localeCompare(a.registered_date||'')||a.client.localeCompare(b.client,'fr'));
 const page=Math.max(1,Math.min(Math.ceil(filtered.length/30)||1,Number(params.page)||1));
 const visible=filtered.slice((page-1)*30,page*30);
 const db=await createClient();const keys=visible.map(c=>c.key);
 const {data:reviews,error}=keys.length?await db.from('quality_reviews').select('id,sale_key,status,reviewed_at').in('sale_key',keys).order('reviewed_at',{ascending:false}):{data:[],error:null};
 if(error)throw new Error('Lecture des contrôles impossible.');
 const latest=new Map<string,{id:string;status:string}>();for(const r of reviews||[])if(r.sale_key&&!latest.has(r.sale_key))latest.set(r.sale_key,{id:r.id,status:r.status});
 const href=(p:number)=>'/qualite/ventes?'+new URLSearchParams({q:params.q||'',status:params.status||'',page:String(p)});
 return <main className="mx-auto max-w-6xl space-y-5 px-6 py-8"><Link href="/qualite" className="text-sm text-star-600 underline">← Tableau qualité</Link><header><h1 className="font-display text-2xl font-bold text-navy-900">Appels à contrôler</h1><p className="mt-1 text-sm text-grey-brand">Ventes MEGA synchronisées, uniquement Effectif ou Salle d’attente. Choisissez un contrat pour ouvrir sa grille d’appel.</p></header>
 <section className="rounded-xl border border-navy-100 bg-white"><form className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_220px_auto]"><label className="text-sm">Client, agent, ID MEGA, EAN ou référence<input name="q" defaultValue={params.q} placeholder="Rechercher une vente" className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2"/></label><label className="text-sm">Statut<select name="status" defaultValue={params.status||''} className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2"><option value="">Les deux statuts</option><option value="Effectif">Effectif</option><option value="Salle d’attente">Salle d’attente</option></select></label><button className="self-end rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">Rechercher</button></form>
 <div className="divide-y divide-navy-100">{visible.map(c=>{const review=latest.get(c.key);return <article key={c.key} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><div className="font-semibold text-navy-900">{c.client||'Client sans nom'} <span className="ml-2 rounded bg-sky-50 px-2 py-1 text-xs text-sky-900">{c.status_class}</span></div><div className="mt-1 text-sm text-grey-brand">{c.energy} · Agent {c.agent_reference||c.agent} · ID MEGA {c.mega_id||'—'} · {c.reference||c.ean||c.key}</div><div className="mt-1 text-xs text-grey-brand">Inscription : {c.registered_date||'—'} · Centre : {c.centre}</div>{review&&<Link href={'/qualite/'+review.id} className="mt-2 inline-block text-xs text-star-600 underline">Dernier contrôle : {review.status}</Link>}</div><Link href={'/qualite/nouveau?sale='+encodeURIComponent(c.key)} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">{review?'Nouveau contrôle':'Contrôler l’appel'}</Link></article>})}{!visible.length&&<p className="p-6 text-sm text-grey-brand">Aucune vente éligible ne correspond à cette recherche.</p>}</div>
 <div className="flex items-center justify-between border-t p-4 text-sm"><Link href={href(Math.max(1,page-1))} aria-disabled={page===1} className={page===1?'pointer-events-none text-grey-brand':'underline'}>Précédent</Link><span>{filtered.length} ventes · page {page} / {Math.max(1,Math.ceil(filtered.length/30))}</span><Link href={href(Math.min(Math.ceil(filtered.length/30)||1,page+1))} aria-disabled={page*30>=filtered.length} className={page*30>=filtered.length?'pointer-events-none text-grey-brand':'underline'}>Suivant</Link></div></section></main>;
}
