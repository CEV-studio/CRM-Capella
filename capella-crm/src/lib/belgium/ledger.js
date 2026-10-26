import { contractCycle } from './finance.js';
/** @param {import('./domain').Contract[]} contracts @param {import('./domain').Statement[]} statements @param {import('./domain').CycleTracking[]} tracking @param {import('./domain').SupplierBilling[]} billing @param {import('./domain').Invoice[]} invoices @param {string} today */
export function accountingLedger(contracts,statements,tracking,billing,invoices,today){
 return contracts.map(c=>{
  const positive=statements.filter(s=>s.key===c.key&&s.gross_cents>0).sort((a,b)=>a.period.localeCompare(b.period));
  const cycle=contractCycle(c,statements,tracking.find(t=>t.contract_key===c.key),today);
  const supplierInvoices=positive.map(s=>({period:s.period,state:billing.find(b=>b.supplier===s.supplier&&b.period===s.period)}));
  const centreInvoices=invoices.filter(i=>i.lines.some(l=>l.key===c.key&&Number(l.centre_cents)>0));
  const terminated=c.status_class==='Résilié'||!!cycle.termination;
  const category=cycle.pending?'verify':cycle.clawback?((cycle.centreRemaining||0)>0||(cycle.megaRemaining||0)>0?'deduct':'settled'):terminated?(cycle.hasCommission?'outside':'uncommissioned'):'current';
  return {contract:c,cycle,category,supplierInvoices,centreInvoices,commission:positive[0]||null,
   supplierInvoiced:supplierInvoices.some(i=>i.state?.invoiced),centreInvoiced:centreInvoices.some(i=>i.state==='Émise'||i.state==='Payée')};
 });
}
