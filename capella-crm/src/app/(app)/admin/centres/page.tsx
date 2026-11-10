import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { centreNames } from '@/lib/belgium/centre-accounts';
import { Card,CardHeader } from '@/components/ui';
import { ColorBadge } from '../../belgique/badges';
import { CreerCentreForm,GestionCentre,NouveauCentre } from './forms';
import { AddSalesAgent,SalesAgentRow } from './agent-forms';
import { ProfilCorbeilleButton } from '@/components/profil-corbeille-button';
export const dynamic='force-dynamic';
export const metadata={title:'Comptes centres et agents — Capella CRM'};
export default async function CentresPage(){
 await requireAdmin();const db=await createClient();
 const [centres,profiles,access,agents]=await Promise.all([centreNames(db),db.from('profiles').select('id,full_name,email,is_active,must_change_password,role').in('role',['be_centre','be_agent']).is('archived_at',null).order('full_name'),db.from('be_access').select('*'),db.from('be_sales_agents').select('id,centre,agent_ref,display_name,is_active').order('centre').order('display_name')]);
 if(profiles.error||access.error||agents.error)throw new Error('Lecture des comptes et agents impossible.');
 return <main className="mx-auto max-w-6xl space-y-6 px-6 py-8"><header><h1 className="font-display text-2xl font-bold text-navy-800">Centres d’appels</h1></header>
 <Card><CardHeader title="Créer un centre"/><NouveauCentre/></Card>
 {centres.map(centre=>{
  const roster=(agents.data||[]).filter(a=>a.centre===centre);
  const members=(profiles.data||[]).filter(p=>access.data?.some(a=>a.user_id===p.id&&a.centre===centre));
  const responsables=members.filter(p=>p.role==='be_centre');
  return <Card key={centre}><CardHeader title={`${centre} · ${roster.length} agents`}/>
   <div className="px-5 pb-4"><a className="text-sm font-semibold underline" href={'/belgique?'+new URLSearchParams({centre})}>Voir la production</a></div>
   <div className="border-t border-navy-100 p-5"><h2 className="font-semibold">Responsables</h2>{responsables.map(p=><div key={p.id} className="mt-3"><strong>{p.full_name}</strong> · {p.email} · {p.is_active?'Actif':'Désactivé'}<GestionCentre id={p.id} active={p.is_active}/><ProfilCorbeilleButton id={p.id} nom={p.full_name}/></div>)}{!responsables.length&&<p className="mt-2 text-sm text-grey-brand">Aucun compte responsable.</p>}<details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Créer un compte responsable</summary><CreerCentreForm centres={centres} centre={centre}/></details></div>
   <div className="border-t border-navy-100 p-5"><h2 className="font-semibold">Agents</h2>{roster.map(agent=>{const membership=(access.data||[]).find(a=>a.centre===centre&&a.agent_ref?.trim().toLowerCase()===agent.agent_ref.trim().toLowerCase());const user=members.find(p=>p.id===membership?.user_id&&p.role==='be_agent');return <div key={agent.id} className="border-b border-navy-100 py-3"><SalesAgentRow agent={agent}/><div className="px-4 text-sm">{user?<><ColorBadge label={user.is_active&&membership?.is_active?'Compte actif':'Compte désactivé'} tone={user.is_active&&membership?.is_active?'emerald':'slate'}/> <span>{user.email}</span><GestionCentre id={user.id} active={user.is_active}/><ProfilCorbeilleButton id={user.id} nom={user.full_name}/></>:<><ColorBadge label="Sans compte" tone="slate"/><details className="mt-2"><summary className="cursor-pointer font-semibold">Créer son compte</summary><CreerCentreForm centres={centres} centre={centre} agentRef={agent.agent_ref} agentName={agent.display_name}/></details></>}</div></div>})}{!roster.length&&<p className="mt-2 text-sm text-grey-brand">Aucun agent référencé.</p>}<details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Ajouter un agent</summary><AddSalesAgent centres={centres} centre={centre}/></details></div>
  </Card>;
 })}
 </main>;
}
