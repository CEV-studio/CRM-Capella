import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader } from '@/components/ui';
import { EquipeForm } from './forms';
import type { PartnerTeam } from '@/lib/domain/database.types';

export const dynamic='force-dynamic';
export const metadata={title:'Équipes partenaires — Capella CRM'};
export default async function EquipesAdminPage(){
 await requireAdmin();const db=await createClient();
 const [teamsResult,profilesResult,statsResult]=await Promise.all([
  db.from('partner_teams').select('*').order('name'),
  db.from('profiles').select('id,full_name,role,is_active,partner_team_id').is('archived_at',null).in('role',['commercial','manager']).order('full_name'),
  db.rpc('partner_team_stats'),
 ]);
 if(teamsResult.error||profilesResult.error||statsResult.error)throw new Error('Impossible de charger les équipes.');
 const teams=(teamsResult.data??[]) as PartnerTeam[];const profiles=profilesResult.data??[];
 const stats=new Map((statsResult.data??[]).map(s=>[s.team_id,s]));
 const managers=profiles.filter(p=>p.role==='manager'&&p.is_active);
 return <main className="mx-auto max-w-6xl space-y-6 px-6 py-8"><header><h1 className="font-display text-2xl font-bold">Équipes partenaires</h1><Link href="/admin/commerciaux" className="text-sm underline">Comptes et affectations</Link></header>
  <Card><CardHeader title="Créer une équipe"/><EquipeForm managers={managers}/></Card>
  <div className="grid gap-5">{teams.map(team=>{const members=profiles.filter(p=>p.role==='commercial'&&p.partner_team_id===team.id);const s=stats.get(team.id);return <Card key={team.id}><CardHeader title={team.name}/><EquipeForm team={team} managers={managers}/><div className="grid gap-3 border-t border-navy-100 px-5 py-4 sm:grid-cols-4">{[['Commerciaux',s?.membres??0],['Prospects actifs',s?.prospects_actifs??0],['Dossiers en cours',s?.dossiers_en_cours??0],['Validés ADV',s?.dossiers_valides??0]].map(([label,value])=><div key={label} className="rounded-lg bg-navy-50 p-3"><div className="text-xs text-grey-brand">{label}</div><div className="mt-1 text-xl font-bold">{value}</div></div>)}</div><div className="border-t border-navy-100 px-5 py-4"><div className="text-sm font-semibold">Commerciaux · {members.length}</div><p className="mt-2 text-sm text-grey-brand">{members.length?members.map(p=>p.full_name+(p.is_active?'':' (désactivé)')).join(' · '):'Aucun commercial affecté.'}</p><Link href="/admin/commerciaux" className="mt-3 inline-block text-sm font-semibold underline">Gérer les affectations</Link></div></Card>})}</div>
  {!teams.length&&<p className="text-sm text-grey-brand">Aucune équipe créée.</p>}
 </main>;
}
