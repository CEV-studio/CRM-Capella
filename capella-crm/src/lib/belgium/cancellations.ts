import { addMonths, norm, type Contract, type CycleTracking } from './domain';

export function cancellationStats(contracts:Contract[],tracking:CycleTracking[]){
 const before:Contract[]=[],after:Contract[]=[],unknown:Contract[]=[],early:Contract[]=[],late:Contract[]=[],pending:Contract[]=[];
 for(const c of contracts){
  const t=tracking.find(t=>t.contract_key===c.key);
  const ended=norm(c.status)==='contrattermine';
  const cancelled=['Annulé','Résilié'].includes(c.status_class)||ended||!!t?.termination_date;
  if(!cancelled)continue;
  const activated=!!c.effect_date||!!t?.effect_date||ended;
  if(!activated){
   if(norm(c.status).includes('parleclient'))before.push(c);else unknown.push(c);
   continue;
  }
  after.push(c);
  // Only confirmed dates establish the three-month boundary. Report dates
  // record observations and must never become confirmed termination dates.
  const start=t?.effect_date,end=t?.termination_date;
  if(!start||!end||end<start){pending.push(c);continue;}
  (end<addMonths(start,3)?early:late).push(c);
 }
 return {before,after,unknown,early,late,pending};
}
