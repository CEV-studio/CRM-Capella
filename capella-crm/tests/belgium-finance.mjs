import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../src/lib/belgium/finance.js',import.meta.url),'utf8');
const {contractCycle,financialModel,shiftMonths,completedMonths,expectedCallDate}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const contract={key:'a',supplier:'MEGA',client:'Test',ean:'541449020000073142',centre:'TILIRA',agent:'Agent',status_class:'Résilié',report_date:'2026-10-20',registered_date:'2026-07-01',period:'2026-07-01',clawback_end:'2026-10-01',gross_cents:6500,centre_cents:3000};
const paid={key:'a',supplier:'MEGA',period:'2026-07-01',gross_cents:6500,centre_cents:3000,status:'Effectif'};
const dates={effect_date:'2026-07-01',termination_date:'2026-09-01'};
let c=contractCycle(contract,[paid],dates,'2026-10-20');
assert.equal(c.clawback,true);assert.equal(c.months,2);assert.equal(c.centreDue,1000);assert.equal(c.megaDue,2167);assert.equal(c.bonusState,'none');
for(const [end,expected] of [['2026-07-01',3000],['2026-08-01',2000],['2026-09-01',1000]])assert.equal(contractCycle(contract,[paid],{effect_date:'2026-07-01',termination_date:end},'2026-10-20').centreDue,expected);
c=contractCycle(contract,[paid],{...dates,centre_recovered_cents:400},'2026-10-20');assert.equal(c.centreRemaining,600);
c=contractCycle(contract,[{...paid,gross_cents:0,centre_cents:0}],dates,'2026-10-20');assert.equal(c.clawback,false);assert.equal(c.pending,false,'uncommissioned cancellation is not a clawback');
c=contractCycle(contract,[paid],{},'2026-10-20');assert.equal(c.pending,true);assert.equal(c.centreDue,null,'unknown dates cannot produce a fabricated recovery');
c=contractCycle(contract,[paid],{effect_date:'2026-07-01',termination_date:'2026-10-01'},'2026-10-20');assert.equal(c.clawback,false);assert.equal(c.bonusState,'due');assert.equal(c.bonusCents,1000);
const active={...contract,status_class:'Effectif'};
c=contractCycle(active,[paid],undefined,'2026-10-20');assert.equal(c.clawback,false);assert.equal(c.bonusState,'potential','observed dates alone do not acquire a bonus');
c=contractCycle({...active,report_date:'2026-09-30'},[paid],{effect_date:'2026-07-01'},'2026-10-20');assert.equal(c.bonusState,'potential','stale active report does not prove retention after three months');
c=contractCycle(active,[paid],{effect_date:'2026-07-01'},'2026-10-20');assert.equal(c.bonusState,'due');
c=contractCycle(active,[paid],{effect_date:'2026-07-01',bonus_invoiced_at:'2026-10-02'},'2026-10-20');assert.equal(c.bonusState,'invoiced');
c=contractCycle(active,[paid],{effect_date:'2026-07-01',bonus_invoiced_at:'2026-10-02',bonus_paid_at:'2026-10-03'},'2026-10-20');assert.equal(c.bonusState,'paid');
assert.equal(shiftMonths('2026-11-30',3),'2027-02-28');assert.equal(expectedCallDate('2026-12-01'),'2027-01-15');assert.equal(completedMonths('2026-01-31','2026-02-28'),1);
const second={...active,key:'b',period:'2026-10-01'};
let m=financialModel([active,second],[paid],[],[{supplier:'MEGA',period:'2026-07-01',invoiced:true,received_cents:0}],{view:'global',year:2026,month:10},'2026-10-20');
assert.equal(m.forecastGross,6500);assert.equal(m.validatedGross,6500);assert.equal(m.invoicedGross,6500);assert.equal(m.receivedGross,0);assert.equal(m.clawbacks.length,0);assert.equal(m.bonusPotential,2000);
m=financialModel([active,second],[paid],[],[],{view:'month',year:2026,month:10},'2026-10-20');assert.equal(m.forecastGross,6500);assert.equal(m.validatedGross,0);assert.equal(m.invoicedGross,0);assert.equal(m.calendar.find(p=>p.period==='2026-10-01').due,'2026-11-15');
m=financialModel([contract],[paid],[{contract_key:'a',...dates}],[],{view:'month',year:2026,month:9},'2026-10-20');assert.equal(m.clawbacks.length,1);assert.equal(m.centreToRecover,1000);
m=financialModel([contract],[paid],[{contract_key:'a',...dates}],[],{view:'month',year:2026,month:10},'2026-10-20');assert.equal(m.clawbacks.length,0);
console.log('PASS: true clawbacks only, 0/1/2/3 months, prorata, recovered balances, no fabricated dates, three-month retention bonus, invoicing vs receipts, monthly periods and M+1 15th.');
const {monthlyProduction}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const cohorts=monthlyProduction([
 {...active,key:'sept',effect_date:'2026-10-05',period:'2026-09-01'},
 {...contract,key:'lost',effect_date:'2026-09-30',period:'2026-09-01'},
 {...active,key:'oct',effect_date:'2026-10-20',period:'2026-10-01'},
 {...contract,key:'never',effect_date:null,period:null,status_class:'Annulé'}
],[{...paid,key:'sept',period:'2026-09-01'}],[]);
assert.equal(cohorts.length,2);
assert.equal(cohorts[1].contracts.length,2);
assert.equal(cohorts[1].active,1);
assert.equal(cohorts[1].terminated,1);
assert.equal(cohorts[1].terminationDatesMissing,1);
assert.equal(cohorts[1].confirmed,1);
assert.equal(cohorts[0].active,1);
