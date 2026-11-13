import { norm, type Contract } from './domain';

// Supplier statuses define these categories; activation alone never proves payment.
export function cancellationStats(contracts:Contract[]){
 return {
  cancelled:contracts.filter(c=>norm(c.status).startsWith('annule')&&norm(c.status).includes('parleclient')),
  terminated:contracts.filter(c=>['contrattermine','termine'].includes(norm(c.status))),
 };
}

export function clawbackCohorts(contracts:Contract[],today:string){
 const current=`${today.slice(0,7)}-01`;
 const months=Array.from({length:4},(_,i)=>{
  const d=new Date(`${current}T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()-3+i);return d.toISOString().slice(0,7);
 });
 return months.map(month=>{
  const cohort=contracts.filter(c=>c.registered_date?.slice(0,7)===month);
  const stats=cancellationStats(cohort);
  const end=new Date(`${month}-01T00:00:00Z`);end.setUTCMonth(end.getUTCMonth()+3);
  return {month,contracts:cohort,registered:cohort.length,active:cohort.filter(c=>c.status_class==='Effectif').length,cancelled:stats.cancelled,terminated:stats.terminated,trackedThrough:end.toISOString().slice(0,7)};
 });
}
