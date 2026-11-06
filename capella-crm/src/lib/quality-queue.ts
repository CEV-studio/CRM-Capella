type QueuedSale={key:string;agent:string;centre:string;registered_date:string|null};
type ReviewedSale={agent_name:string;agent_centre:string|null;sale_key:string|null;sale_reference:string;reviewed_at:string};

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const agentKey=(centre:string,agent:string)=>`${normalize(centre)}:${normalize(agent)}`;
const saleDate=(sale:QueuedSale)=>sale.registered_date||'9999-12-31';

/** Répartit la file entre agents selon leurs contrôles récents, sans modifier les ventes. */
export function balancedQualityQueue<T extends QueuedSale>(sales:T[],reviews:ReviewedSale[],allSales:T[],now=new Date()){
 const saleByKey=new Map(allSales.map(sale=>[sale.key,sale]));
 const cutoff=now.getTime()-30*24*60*60*1000;
 const counts=new Map<string,number>();
 for(const review of reviews){
  if(new Date(review.reviewed_at).getTime()<cutoff)continue;
  const sale=saleByKey.get(review.sale_key||'')||saleByKey.get(review.sale_reference);
  const key=agentKey(sale?.centre||review.agent_centre||'',sale?.agent||review.agent_name);
  counts.set(key,(counts.get(key)||0)+1);
 }
 const groups=new Map<string,T[]>();
 for(const sale of sales){
  const key=agentKey(sale.centre,sale.agent);
  const group=groups.get(key)||[];
  group.push(sale);
  groups.set(key,group);
 }
 for(const group of groups.values())group.sort((a,b)=>saleDate(a).localeCompare(saleDate(b))||a.key.localeCompare(b.key));
 const projected=new Map(counts);
 const ordered:T[]=[];
 while(ordered.length<sales.length){
  const candidates=[...groups].filter(([,group])=>group.length>0);
  candidates.sort(([keyA,groupA],[keyB,groupB])=>
   (projected.get(keyA)||0)-(projected.get(keyB)||0)
   ||saleDate(groupA[0]).localeCompare(saleDate(groupB[0]))
   ||keyA.localeCompare(keyB));
  const [key,group]=candidates[0];
  ordered.push(group.shift()!);
  projected.set(key,(projected.get(key)||0)+1);
 }
 return {ordered,completedFor:(sale:T)=>counts.get(agentKey(sale.centre,sale.agent))||0,
  agentCount:groups.size};
}
