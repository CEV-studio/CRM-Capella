import { norm,type Contract } from './domain';
export type ProductionContract=Contract&{phone?:string;postal_code?:string;product?:string;agent_reference?:string};
export type ProductionHistory={contract_key:string;date:string;before_status:string|null;status:string;agent:string};
export function clientDirectory(contracts:ProductionContract[],filters:Record<string,string|undefined>={}){
 const groups=new Map<string,ProductionContract[]>();
 for(const c of contracts){if(filters.centre&&c.centre!==filters.centre)continue;
  const list=groups.get(c.mega_id)||[];list.push(c);groups.set(c.mega_id,list);}
 return [...groups].map(([id,rows])=>({id,name:rows[0].client,phone:rows.find(c=>c.phone)?.phone||'',contracts:rows})).filter(c=>{
  const all=norm([c.id,c.name,...c.contracts.flatMap(r=>[r.agent,r.agent_reference,r.ean,r.reference])].join(' '));
  return (!filters.q||filters.q.trim().split(/\s+/).every(t=>all.includes(norm(t))))&&(!filters.mega||c.id.includes(filters.mega.trim()))&&(!filters.name||filters.name.trim().split(/\s+/).every(t=>norm(c.name).includes(norm(t))))&&(!filters.agent||c.contracts.some(r=>norm(r.agent+' '+(r.agent_reference||'')).includes(norm(filters.agent))))&&(!filters.status||c.contracts.some(r=>r.status_class===filters.status));
 }).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
}
