import Link from 'next/link';
import { BelgiumClients } from './clients';
import { redirect } from 'next/navigation';
import { loadBelgiumProduction } from '@/lib/belgium/server';
import { BelgiumDashboard,DashboardFilters } from './dashboard';
import { AgentKpis } from './agent-kpis';
import type { DashboardScope } from '@/lib/belgium/dashboard';
import type { Statement } from '@/lib/belgium/domain';
export const dynamic='force-dynamic';
export const metadata={title:'Belgique · Production — Capella CRM'};
export default async function BelgiumPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const params=await searchParams;
 const {profile,contracts,tracking,last_report,history}=await loadBelgiumProduction({historyClient:params.client});
 if(['billing','cycles','imports'].includes(params.tab||'')){
  if(profile.role==='admin')redirect('/comptabilite/belgique?'+new URLSearchParams(Object.entries(params).filter((p):p is [string,string]=>typeof p[1]==='string')));
  redirect('/belgique');
 }
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const year=Number(params.year)||Number(today.slice(0,4)),month=Math.max(1,Math.min(12,Number(params.month)||Number(today.slice(5,7))));
 const scope:DashboardScope={view:params.view==='month'?'month':params.view==='year'?'year':'global',year,month};
 const years=[...new Set([year,...contracts.flatMap(c=>[c.registered_date,c.period].filter(Boolean).map(d=>Number(d!.slice(0,4))))])].sort((a,b)=>b-a);
 const energyContracts=contracts.filter(c=>['Elec','Gaz'].includes(c.energy));
 const centres=[...new Set(energyContracts.map(c=>c.centre))].sort();const scoped=energyContracts.filter(c=>!params.centre||params.centre===c.centre);
 // Period confirmation metadata only; amounts never enter the production response.
 const statements:Statement[]=contracts.filter(c=>c.period_confirmed&&c.period).map(c=>({key:c.key,supplier:c.supplier,period:c.period!,status:c.status,gross_cents:0,centre_cents:0}));
 if(params.tab==='contracts'){
  const legacy={...params,tab:'clients',client:contracts.find(c=>c.key===params.contract)?.mega_id||params.client};
  redirect('/belgique?'+new URLSearchParams(Object.entries(legacy).filter((p):p is [string,string]=>typeof p[1]==='string'&&p[0]!=='contract')));
 }
 const tab=profile.role==='be_agent'||params.tab==='clients'?'clients':profile.role==='admin'&&params.tab==='agents'?'agents':'dashboard';
 const url=(extra:Record<string,string>)=>'/belgique?'+new URLSearchParams({...Object.fromEntries(Object.entries(params).filter((p):p is [string,string]=>typeof p[1]==='string')),...extra});
 return <main className="mx-auto max-w-[1500px] space-y-6 px-6 py-8"><header className="flex flex-wrap items-end justify-between gap-4 border-b border-navy-200 pb-5"><div><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-500">{profile.role==='be_agent'?'Espace agent':'Espace Belgique'}</div><h1 className="font-display text-2xl font-bold text-navy-900">{profile.role==='be_agent'?'Mes ventes':'Production'}</h1></div>{profile.role==='admin'&&<Link href="/comptabilite/belgique" className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm font-semibold">Comptabilité Belgique</Link>}</header>
 {profile.role==='be_agent'&&<Link href="/belgique/encoder" className="inline-block rounded-xl bg-navy-800 px-4 py-3 text-sm font-semibold text-white">Encoder une vente</Link>}
 {profile.role!=='be_agent'&&<nav aria-label="Vues Belgique" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-navy-200 bg-white p-1 shadow-sm">{[['dashboard','Tableau de bord'],['clients','Base clients'],...(profile.role==='admin'?[['agents','KPI agents']]:[])].map(([id,label])=><Link key={id} href={url({tab:id,contract:''})} className={`rounded-xl px-4 py-2 text-sm ${tab===id?'bg-navy-800 text-white':'text-navy-600 hover:bg-navy-50'}`}>{label}</Link>)}</nav>}
 {tab!=='clients'&&<DashboardFilters scope={scope} years={years} centre={params.centre||''} centres={centres} tab={tab}/>}
 {tab==='clients'?<BelgiumClients contracts={contracts} history={history||[]} tracking={tracking} params={params} actor={profile}/>:tab==='agents'?<AgentKpis contracts={contracts} scope={scope} centre={params.centre||''}/>:<BelgiumDashboard contracts={scoped} allContracts={energyContracts} centres={centres} statements={statements} scope={scope} today={today} centre={params.centre||''} tracking={tracking} billing={[]} lastImport={last_report||'—'}/>}

 </main>;
}
