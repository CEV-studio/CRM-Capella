/**
 * Montants en centimes. Les dates de cycle sont confirmées séparément des
 * dates observées dans les reportings. Aucune acquisition ni reprise n'est
 * déduite du seul passage du temps.
 * @typedef {import('./domain').Contract} Contract
 * @typedef {import('./domain').Statement} Statement
 * @typedef {import('./domain').CycleTracking} CycleTracking
 * @typedef {import('./domain').SupplierBilling} SupplierBilling
 * @typedef {import('./dashboard').DashboardScope} DashboardScope
 */
/** @param {string} date @param {number} months */
export function shiftMonths(date, months) {
 const d=new Date(date+'T00:00:00Z'),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
 d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));
 return d.toISOString().slice(0,10);
}
/** @param {string} start @param {string} end */
export function completedMonths(start,end) {
 let count=0;for(let i=1;i<=3;i++)if(shiftMonths(start,i)<=end)count=i;return count;
}
/** @param {string} period */
export function expectedCallDate(period){return shiftMonths(period,1).slice(0,7)+'-15';}
/** @param {string|null|undefined} date @param {DashboardScope} scope */
export function matchesFinancePeriod(date,scope) {
 return scope.view==='global'||!!date&&date.slice(0,4)===String(scope.year)&&(scope.view==='year'||Number(date.slice(5,7))===scope.month);
}
/** @param {Contract} contract @param {Statement[]} statements @param {CycleTracking|undefined} tracking @param {string} today */
export function contractCycle(contract,statements,tracking,today) {
 const first=statements.filter(s=>s.key===contract.key&&s.gross_cents>0).sort((a,b)=>a.period.localeCompare(b.period))[0];
 const start=tracking?.effect_date||null,termination=tracking?.termination_date||null;
 const end=start?shiftMonths(start,3):null;
 const terminated=contract.status_class==='Résilié'||!!termination;
 const hasCommission=!!first;
 const pending=hasCommission&&terminated&&(!start||!termination);
 const clawback=hasCommission&&terminated&&!!start&&!!termination&&termination>=start&&termination<shiftMonths(start,3);
 const months=clawback?completedMonths(start,termination):null;
 const centreDue=clawback?Math.round(first.centre_cents*(3-Number(months))/3):null;
 const megaDue=clawback?Math.round(first.gross_cents*(3-Number(months))/3):null;
 const centreRecovered=tracking?.centre_recovered_cents||0,megaRecovered=tracking?.mega_recovered_cents||0;
 const mature=!!tracking?.completed_at&&tracking.completed_at<=today||
  !!end&&end<=today&&(!!termination&&termination>=end||contract.status_class==='Effectif'&&contract.report_date>=end);
 const bonusState=mature?(tracking?.bonus_paid_at?'paid':tracking?.bonus_invoiced_at?'invoiced':'due'):!terminated&&contract.status_class==='Effectif'?'potential':'none';
 const bonusDate=tracking?.completed_at||end||contract.clawback_end||null;
 return {key:contract.key,client:contract.client,ean:contract.ean,centre:contract.centre,agent:contract.agent,
  start,termination,end,hasCommission,pending,clawback,months,centreDue,megaDue,
  centreRecovered,megaRecovered,centreRemaining:centreDue===null?null:Math.max(0,centreDue-centreRecovered),
  megaRemaining:megaDue===null?null:Math.max(0,megaDue-megaRecovered),
  bonusState,bonusDate,bonusCents:bonusState==='none'?0:1000};
}
/** @param {Contract[]} contracts @param {Statement[]} statements @param {CycleTracking[]} tracking @param {SupplierBilling[]} billing @param {DashboardScope} scope @param {string} today */
export function financialModel(contracts,statements,tracking,billing,scope,today) {
 const keys=new Set(contracts.map(c=>c.key));
 const official=statements.filter(s=>keys.has(s.key)&&matchesFinancePeriod(s.period,scope));
 const forecast=contracts.filter(c=>c.status_class==='Effectif'&&!statements.some(s=>s.key===c.key)&&matchesFinancePeriod(c.period,scope));
 const validatedGross=official.reduce((n,s)=>n+s.gross_cents,0),validatedCentre=official.reduce((n,s)=>n+s.centre_cents,0);
 const forecastGross=forecast.reduce((n,c)=>n+c.gross_cents,0),forecastCentre=forecast.reduce((n,c)=>n+c.centre_cents,0);
 const invoicePeriods=new Set(billing.filter(b=>b.invoiced).map(b=>b.supplier+':'+b.period));
 const invoicedGross=official.filter(s=>invoicePeriods.has(s.supplier+':'+s.period)).reduce((n,s)=>n+s.gross_cents,0);
 const invoicedCentre=official.filter(s=>invoicePeriods.has(s.supplier+':'+s.period)).reduce((n,s)=>n+s.centre_cents,0);
 const receivedGross=billing.filter(b=>matchesFinancePeriod(b.period,scope)).reduce((n,b)=>n+b.received_cents,0);
 const cycles=contracts.map(c=>contractCycle(c,statements,tracking.find(t=>t.contract_key===c.key),today));
 const clawbacks=cycles.filter(c=>c.clawback&&matchesFinancePeriod(c.termination,scope));
 const pending=cycles.filter(c=>c.pending&&matchesFinancePeriod(c.termination,scope));
 const bonuses=cycles.filter(c=>matchesFinancePeriod(c.bonusDate,scope));
 const sumBonus=(/** @type {string} */state)=>bonuses.filter(c=>c.bonusState===state).reduce((n,c)=>n+c.bonusCents,0);
 const periods=[...new Set([...contracts.filter(c=>c.status_class==='Effectif').map(c=>c.period||'').filter(Boolean),...statements.filter(s=>keys.has(s.key)).map(s=>s.period),...billing.map(b=>b.period)])].filter(Boolean).sort().reverse();
 const calendar=periods.filter(p=>matchesFinancePeriod(p,scope)).map(period=>{
  const lines=statements.filter(s=>keys.has(s.key)&&s.period===period);
  const state=billing.find(b=>b.period===period&&b.supplier==='MEGA');
  const gross=lines.reduce((n,s)=>n+s.gross_cents,0);
  return {period,due:expectedCallDate(period),validated:lines.length>0,gross,invoiced:!!state?.invoiced,
   received:state?.received_cents||0,callReceived:state?.call_received_at||null,
   state:state||null,late:expectedCallDate(period)<today&&lines.length===0};
 });
 return {validatedGross,validatedCentre,validatedCapella:validatedGross-validatedCentre,forecastGross,forecastCentre,
  forecastCapella:forecastGross-forecastCentre,invoicedGross,invoicedCapella:invoicedGross-invoicedCentre,receivedGross,
  clawbacks,pending,cycles,centreToRecover:clawbacks.reduce((n,c)=>n+(c.centreRemaining||0),0),
  megaToRepay:clawbacks.reduce((n,c)=>n+(c.megaRemaining||0),0),
  pendingGlobal:cycles.filter(c=>c.pending).length,bonusPotential:sumBonus('potential'),bonusDue:sumBonus('due'),
  bonusInvoiced:sumBonus('invoiced'),bonusPaid:sumBonus('paid'),bonusUndated:cycles.filter(c=>c.bonusState!=='none'&&!c.bonusDate).length,calendar};
}

/** Production par cohorte de commissionnement, conservée après résiliation.
 * @param {Contract[]} contracts @param {Statement[]} statements @param {CycleTracking[]} tracking
 */
export function monthlyProduction(contracts,statements,tracking) {
 const groups=new Map();
 for(const c of contracts){
  const official=statements.filter(s=>s.key===c.key).sort((a,b)=>a.period.localeCompare(b.period))[0];
  if(!c.effect_date&&c.status_class!=='Effectif'&&!official)continue;
  const period=official?.period||c.period||null;
  const key=period||'unknown';
  if(!groups.has(key))groups.set(key,{period,contracts:[],active:0,terminated:0,other:0,confirmed:0,terminationDatesMissing:0});
  const row=groups.get(key);row.contracts.push(c);if(official)row.confirmed++;
  if(c.status_class==='Effectif')row.active++;
  else if(c.status_class==='Résilié'){row.terminated++;if(!tracking.find(t=>t.contract_key===c.key)?.termination_date)row.terminationDatesMissing++;}
  else row.other++;
 }
 return [...groups.values()].sort((a,b)=>(b.period||'').localeCompare(a.period||''));
}
