import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card,CardHeader } from '@/components/ui';
import { inScope,type DashboardScope } from '@/lib/belgium/dashboard';
import type { ProductionContract } from '@/lib/belgium/clients';
import { cancellationStats } from '@/lib/belgium/cancellations';

const identity=(centre:string,ref:string)=>`${centre}\u0000${ref.trim().toLocaleLowerCase('fr')}`;
export async function AgentKpis({contracts,scope,centre}:{contracts:ProductionContract[];scope:DashboardScope;centre:string}){
 const db=await createClient();
 const {data:agents,error}=await db.from('be_sales_agents').select('id,centre,agent_ref,display_name,is_active').order('centre').order('display_name');
 if(error)throw new Error('Lecture des agents impossible.');
 const scoped=contracts.filter(c=>(!centre||c.centre===centre)&&inScope(c.registered_date,scope));
 const keys=new Map<string,{agent:string;sale:string}>();
 for(const c of scoped){const value={agent:identity(c.centre,c.agent_reference||c.agent),sale:c.key};keys.set(c.key,value);if(c.entry_id)keys.set(`SAISIE:${c.entry_id}`,value);}
 const reviewSales=new Map<string,Map<string,{sum:number;count:number}>>();
 for(let offset=0;;offset+=1000){
  const {data,error:reviewError}=await db.from('quality_reviews').select('sale_key,score_percent').order('reviewed_at',{ascending:false}).range(offset,offset+999);
  if(reviewError)throw new Error('Lecture des scores qualité impossible.');
  for(const review of data||[]){const match=keys.get(review.sale_key||'');if(!match)continue;const agent=match.agent;
   const sales=reviewSales.get(agent)||new Map<string,{sum:number;count:number}>();
   const sale=sales.get(match.sale)||{sum:0,count:0};sale.sum+=Number(review.score_percent);sale.count++;sales.set(match.sale,sale);reviewSales.set(agent,sales);
  }
  if(!data||data.length<1000)break;
 }
 const counts=new Map<string,ProductionContract[]>();for(const c of scoped){const key=identity(c.centre,c.agent_reference||c.agent);counts.set(key,[...(counts.get(key)||[]),c]);}
 const selected=(agents||[]).filter(a=>!centre||a.centre===centre);
 const known=new Set(selected.map(a=>identity(a.centre,a.agent_ref)));
 const unknown=[...counts].filter(([key])=>!known.has(key));
 return <div className="space-y-5"><Card><CardHeader title={`Production par agent · ${selected.length} agents enregistrés`}/><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-navy-50"><tr>{['Agent','Centre','Ventes','Signées','Effectives','Salle d’attente','Annulé client','Terminé / clawback','Ventes contrôlées','Score qualité'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{selected.map(a=>{const key=identity(a.centre,a.agent_ref),sales=counts.get(key)||[],reviews=reviewSales.get(key),scores=[...(reviews?.values()||[])].map(v=>v.sum/v.count),mean=scores.length?scores.reduce((n,v)=>n+v,0)/scores.length:null;const count=(status:string)=>sales.filter(c=>c.status_class===status).length;const cancellations=cancellationStats(sales);return <tr key={a.id} className="border-t border-navy-100"><td className="px-4 py-3"><Link className="font-semibold text-star-600 underline" href={'/belgique?'+new URLSearchParams({tab:'clients',centre:a.centre,agent:a.agent_ref,cohortView:scope.view,year:String(scope.year),month:String(scope.month)})}>{a.display_name}</Link><div className="font-mono text-xs text-grey-brand">{a.agent_ref}{!a.is_active?' · Inactif':''}</div></td><td className="px-4 py-3">{a.centre}</td><td className="px-4 py-3 font-semibold">{sales.length}</td><td className="px-4 py-3">{count('Signé')}</td><td className="px-4 py-3">{count('Effectif')}</td><td className="px-4 py-3">{count('Salle d’attente')}</td><td className="px-4 py-3">{cancellations.cancelled.length}</td><td className="px-4 py-3">{cancellations.terminated.length}</td><td className="px-4 py-3">{scores.length}</td><td className="px-4 py-3 font-semibold">{mean===null?'—':`${mean.toFixed(1)} %`}</td></tr>})}</tbody></table></div>{!selected.length&&<p className="p-5 text-sm">Aucun agent enregistré pour ce centre.</p>}</Card>{unknown.length>0&&<Card><CardHeader title="Références à attribuer"/><div className="space-y-2 p-5 text-sm">{unknown.map(([key,rows])=><p key={key}>{rows[0].centre} · {rows[0].agent_reference||rows[0].agent} · {rows.length} vente{rows.length>1?'s':''}</p>)}<Link href="/admin/centres" className="inline-block font-semibold text-star-600 underline">Gérer les agents</Link></div></Card>}</div>;
}
