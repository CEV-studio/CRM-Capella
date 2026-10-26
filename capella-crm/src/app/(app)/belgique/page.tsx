import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loadBelgiumProduction } from '@/lib/belgium/server';
import { Card,CardHeader } from '@/components/ui';
import { BelgiumDashboard,DashboardFilters } from './dashboard';
import type { DashboardScope } from '@/lib/belgium/dashboard';
import type { Statement } from '@/lib/belgium/domain';
export const dynamic='force-dynamic';
export const metadata={title:'Belgique · Production — Capella CRM'};
export default async function BelgiumPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const {profile,contracts,tracking,last_report}=await loadBelgiumProduction();const params=await searchParams;
 if(['billing','cycles','imports'].includes(params.tab||'')){
  if(profile.role==='admin')redirect('/comptabilite/belgique?'+new URLSearchParams(Object.entries(params).filter((p):p is [string,string]=>typeof p[1]==='string')));
  redirect('/belgique');
 }
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const year=Number(params.year)||Number(today.slice(0,4)),month=Math.max(1,Math.min(12,Number(params.month)||Number(today.slice(5,7))));
 const scope:DashboardScope={view:params.view==='month'?'month':params.view==='year'?'year':'global',year,month};
 const years=[...new Set([year,...contracts.flatMap(c=>[c.registered_date,c.period].filter(Boolean).map(d=>Number(d!.slice(0,4))))])].sort((a,b)=>b-a);
 const centres=[...new Set(contracts.map(c=>c.centre))].sort();const scoped=contracts.filter(c=>!params.centre||params.centre===c.centre);
 // Period confirmation metadata only; amounts never enter the production response.
 const statements:Statement[]=contracts.filter(c=>c.period_confirmed&&c.period).map(c=>({key:c.key,supplier:c.supplier,period:c.period!,status:c.status,gross_cents:0,centre_cents:0}));
 const tab=params.tab==='contracts'?'contracts':'dashboard';
 const selected=scoped.filter(c=>(!params.status||c.status_class===params.status)&&(!params.q||[c.client,c.agent,c.ean,c.mega_id,c.reference].join(' ').toLowerCase().includes(params.q.toLowerCase()))&&(!params.contract||c.key===params.contract)&&(!(params.cohortView==='month'||params.cohortView==='year')||c.registered_date?.slice(0,4)===String(year)&&(params.cohortView==='year'||Number(c.registered_date.slice(5,7))===month)));
 const chosen=contracts.find(c=>c.key===params.contract);
 const url=(extra:Record<string,string>)=>'/belgique?'+new URLSearchParams({...Object.fromEntries(Object.entries(params).filter((p):p is [string,string]=>typeof p[1]==='string')),...extra});
 return <main className="mx-auto max-w-[1500px] space-y-6 px-6 py-8"><header className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl font-bold text-navy-800">Belgique · Production</h1>{profile.role==='admin'&&<Link href="/comptabilite/belgique" className="rounded-xl border border-navy-200 px-4 py-2 text-sm">Comptabilité Belgique</Link>}</header>
 <nav className="flex gap-2">{[['dashboard','Tableau de bord'],['contracts','Contrats']].map(([id,label])=><Link key={id} href={url({tab:id,contract:''})} className={`rounded-xl px-4 py-2 text-sm ${tab===id?'bg-navy-800 text-white':'border bg-white'}`}>{label}</Link>)}</nav>
 <DashboardFilters scope={scope} years={years} centre={params.centre||''} centres={centres} tab={tab}/>
 {tab==='dashboard'?<BelgiumDashboard contracts={scoped} allContracts={contracts} centres={centres} statements={statements} scope={scope} today={today} centre={params.centre||''} tracking={tracking} billing={[]} lastImport={last_report||'—'}/>:<Card><CardHeader title={`Contrats · ${selected.length}`}/><form className="flex flex-wrap gap-3 p-5"><input type="hidden" name="tab" value="contracts"/><input type="hidden" name="centre" value={params.centre||''}/><input className="rounded-lg border p-2" name="q" placeholder="Client, EAN, agent ou référence" defaultValue={params.q}/><select className="rounded-lg border p-2" name="status" defaultValue={params.status||''}><option value="">Tous les statuts</option>{[...new Set(contracts.map(c=>c.status_class))].sort().map(s=><option key={s}>{s}</option>)}</select><button className="rounded-lg border px-4">Rechercher</button></form><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Client / EAN','Agent / centre','Statut','Inscription','Mois de production','Dernier reporting'].map(h=><th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{selected.map(c=><tr className="border-t" key={c.key}><td className="p-4"><Link className="font-semibold underline" href={url({contract:c.key})}>{c.client}</Link><div className="text-xs">{c.energy} · {c.ean}</div></td><td className="p-4">{c.agent}<div>{c.centre}</div></td><td className="p-4">{c.status}</td><td className="p-4">{c.registered_date||'—'}</td><td className="p-4">{c.period?.slice(0,7)||'—'}</td><td className="p-4">{c.report_date}</td></tr>)}</tbody></table></div>{chosen&&<div className="border-t p-5"><h2 className="font-semibold">{chosen.client} · {chosen.reference}</h2><p className="mt-2 text-sm">{chosen.phone||'Téléphone non renseigné'} · {chosen.postal_code||''} · {chosen.product||''}</p><p className="mt-2 text-sm">Résiliation confirmée : {tracking.find(t=>t.contract_key===chosen.key)?.termination_date||'—'}</p><Link className="mt-3 inline-block text-sm underline" href={url({contract:''})}>Tous les contrats</Link></div>}</Card>}
 </main>;
}
