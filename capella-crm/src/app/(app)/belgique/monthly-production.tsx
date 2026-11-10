import Link from 'next/link';
import { StatusBadge } from './badges';
import { Card,CardHeader } from '@/components/ui';
import { monthlyProduction,matchesFinancePeriod } from '@/lib/belgium/finance';
import type { Contract,Statement,CycleTracking } from '@/lib/belgium/domain';
import type { DashboardScope } from '@/lib/belgium/dashboard';
const monthLabel=(p:string|null)=>p?new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(p+'T00:00:00Z')):'Mois à déterminer';
export function MonthlyProduction({contracts,statements,tracking,scope,today}:{contracts:Contract[];statements:Statement[];tracking:CycleTracking[];scope:DashboardScope;today:string}){
 const production=monthlyProduction(contracts,statements,tracking);
 const current=today.slice(0,7)+'-01';
 const shift=(offset:number)=>{const date=new Date(current+'T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+offset);return date.toISOString().slice(0,7)+'-01';};
 const previous=shift(-1);
 const periods=[{month:previous,label:'Production précédente',cutoff:current.slice(0,7)+'-14'},{month:current,label:'Nouvelle production',cutoff:shift(1).slice(0,7)+'-14'}];
 const rows=production.filter(r=>!r.period?scope.view==='global':matchesFinancePeriod(r.period,scope));
 return <div className="space-y-4">
 <section aria-label="Production précédente et mois en cours" className="grid gap-4 sm:grid-cols-2">
 {periods.map(({month,label,cutoff})=>{
  const cohort=production.find(row=>row.period===month);
  const registered=contracts.filter(c=>c.registered_date?.slice(0,7)===month.slice(0,7)).length;
  const cutoffLabel=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(cutoff+'T00:00:00Z'));
  return <Card key={month}><div className="p-5"><div className="text-sm font-semibold text-navy-600">{label}</div><h2 className="mt-1 text-xl font-bold capitalize text-navy-900">{monthLabel(month)}</h2><p className="mt-1 text-sm text-navy-600">{today<=cutoff?'Fenêtre ouverte jusqu’au':'Fenêtre close le'} {cutoffLabel} inclus</p><dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2"><div><dt className="text-sm text-navy-600">Inscriptions du mois</dt><dd className="text-xl font-bold">{registered}</dd></div><div><dt className="text-sm text-navy-600">Effectifs rattachés</dt><dd className="text-xl font-bold">{cohort?.active??0}</dd></div></dl></div></Card>;
 })}
 </section>
 <Card><CardHeader title="Effectifs et résiliations par mois de production" />
 <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-sky-100/80 text-sky-950"><tr>{['Mois de production','Effectifs initiaux / observés','Résiliés depuis','Encore effectifs','Autres sorties','Période'].map(h=><th className="px-5 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.period||'unknown'} className="border-t border-navy-100"><th className="px-5 py-4 capitalize">{monthLabel(r.period)}</th><td className="px-5 py-4 font-semibold">{r.contracts.length}</td><td className="bg-violet-50 px-5 py-4 font-semibold text-violet-800">{r.terminated}</td><td className="bg-emerald-50 px-5 py-4 font-semibold text-emerald-800">{r.active}</td><td className="px-5 py-4">{r.other}</td><td className="px-5 py-4">{r.confirmed===r.contracts.length?'Appel MEGA':r.confirmed?`${r.confirmed} confirmés · solde provisoire`:'Provisoire'}</td></tr>)}</tbody></table></div>

 <div className="space-y-3 p-5">{rows.map(r=><details key={r.period||'unknown'} className="rounded-xl border border-sky-200 bg-sky-50/60 p-4"><summary className="cursor-pointer font-semibold capitalize">{monthLabel(r.period)} · voir les {r.contracts.length} contrats et leurs statuts</summary><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Client / EAN','Centre / agent','Statut actuel','Date de résiliation confirmée'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{r.contracts.map((c:Contract)=><tr key={c.key} className="border-t border-navy-100"><td className="p-3"><Link className="underline" href={'/belgique?'+new URLSearchParams({tab:'clients',client:c.mega_id})}>{c.client}</Link><div className="text-xs">{c.energy} · {c.ean}</div></td><td className="p-3">{c.centre}<div className="text-xs">{c.agent}</div></td><td className="p-3"><StatusBadge value={c.status}/></td><td className="p-3">{tracking.find(t=>t.contract_key===c.key)?.termination_date||(c.status_class==='Résilié'?'À confirmer':'—')}</td></tr>)}</tbody></table></div></details>)}</div></Card></div>;
}
