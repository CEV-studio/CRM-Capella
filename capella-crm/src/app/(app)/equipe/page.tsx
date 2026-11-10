import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, KpiTile } from '@/components/ui';
import { fmtNombre, fmtDateHeure } from '@/lib/format';
import { nomComplet } from '@/lib/domain/noms';
import { PROSPECT_STAGES } from '@/lib/domain/stages';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mon équipe — Capella CRM' };

type TeamMember = { id:string; full_name:string; is_active:boolean; partner_team_id:string|null; role:'commercial'|'manager' };
type CommentedProspect = { id:string; assigned_to:string; raison_sociale:string|null; nom:string|null; prenom:string|null; notes:string|null; last_action_at:string|null }; 
type ProspectRow = { assigned_to:string; stage:string; next_action_date:string|null };
type AffaireRow = { commercial_id:string; stage:string };

export default async function EquipePage({searchParams}:{searchParams:Promise<{team?:string}>}) {
  const profile = await requireProfile();
  if (!['manager','admin'].includes(profile.role)) redirect('/?motif=acces-refuse');
  // Admins can select any team; managers remain restricted to their active teams.
  const isAdmin=profile.role==='admin';
  const db = createAdminClient();
  let teamsQuery=db.from('partner_teams').select('id,name,is_active,manager_id').order('name');
  if(!isAdmin)teamsQuery=teamsQuery.eq('manager_id',profile.id).eq('is_active',true);
  const {data:teams,error:teamsError}=await teamsQuery;
  if(teamsError)throw new Error('Impossible de charger les équipes.');
  const requestedTeam=(await searchParams).team;
  const selectedTeam=isAdmin?(teams??[]).find(team=>team.id===requestedTeam):undefined;
  const teamIds=isAdmin?(selectedTeam?[selectedTeam.id]:[]):(teams??[]).map(team=>team.id);
  let membersQuery=db.from('profiles').select('id,full_name,is_active,partner_team_id,role').eq('role','commercial').is('archived_at',null).order('full_name');
  if(isAdmin && selectedTeam) membersQuery=membersQuery.eq('partner_team_id',selectedTeam.id);
  else if(!isAdmin) membersQuery=teamIds.length?membersQuery.or(`partner_team_id.in.(${teamIds.join(',')}),and(partner_team_id.is.null,manager_id.eq.${profile.id})`):membersQuery.is('partner_team_id',null).eq('manager_id',profile.id);
  const { data: membres, error: teamError } = await membersQuery;
  if (teamError) throw new Error('Impossible de charger l’équipe.');
  const managerIds=isAdmin
    ? [...new Set((selectedTeam?[selectedTeam]:(teams??[])).map(t=>t.manager_id).filter((id):id is string=>!!id))]
    : [profile.id];
  let managers:TeamMember[]=[];
  if(managerIds.length){
    const {data,error}=await db.from('profiles').select('id,full_name,is_active,partner_team_id,role').in('id',managerIds).eq('role','manager').is('archived_at',null).order('full_name');
    if(error)throw new Error('Impossible de charger les responsables.');
    managers=(data??[]) as TeamMember[];
  }
  const team = [...managers,...((membres ?? []) as TeamMember[])];
  const teamNames=new Map((teams??[]).map(t=>[t.id,t.name]));
  const ids = team.map(m => m.id);
  const prospects:ProspectRow[]=[]; const affaires:AffaireRow[]=[];
  let commented:CommentedProspect[]=[];
  if (ids.length) {
    // Read every page: team KPIs must stay correct beyond the API row limit.
    for (let offset=0;;offset+=1000) {
      const {data,error}=await db.from('prospects').select('assigned_to,stage,next_action_date').in('assigned_to',ids).is('deleted_at',null).order('id').range(offset,offset+999);
      if(error) throw new Error('Impossible de charger les indicateurs de prospection.');
      prospects.push(...(data??[]) as ProspectRow[]); if(!data||data.length<1000)break;
    }
    for (let offset=0;;offset+=1000) {
      const {data,error}=await db.from('affaires').select('commercial_id,stage').in('commercial_id',ids).is('deleted_at',null).order('id').range(offset,offset+999);
      if(error) throw new Error('Impossible de charger les indicateurs des dossiers.');
      affaires.push(...(data??[]) as AffaireRow[]); if(!data||data.length<1000)break;
    }
  }
  if(isAdmin&&ids.length){
    const {data,error}=await db.from('prospects').select('id,assigned_to,raison_sociale,nom,prenom,notes,last_action_at').in('assigned_to',ids).is('deleted_at',null).not('notes','is',null).order('last_action_at',{ascending:false,nullsFirst:false}).order('id').limit(100);
    if(error)throw new Error('Impossible de charger les commentaires.');
    commented=((data??[]) as CommentedProspect[]).filter(p=>p.notes?.trim());
  }
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const inactiveStages = new Set(['KO','Numéro KO','Pas intéressé','DDF trop éloignée']);
  const rows=team.map(member=>{
    const leads=prospects.filter(p=>p.assigned_to===member.id);
    const dossiers=affaires.filter(a=>a.commercial_id===member.id);
    const signed=dossiers.filter(a=>a.stage==='Signé');
    return {...member, actifs:leads.filter(p=>!inactiveStages.has(p.stage)).length,
      retards:leads.filter(p=>!inactiveStages.has(p.stage)&&p.next_action_date&&p.next_action_date<today).length,
      encours:dossiers.filter(a=>!['Signé','KO'].includes(a.stage)).length,
      valides:signed.length};
  });
  const sum=(key:'actifs'|'retards'|'encours'|'valides')=>rows.reduce((total,row)=>total+row[key],0);
  const statusTotals=new Map<string,number>();
  const statusByMember=new Map<string,Map<string,number>>();
  for(const prospect of prospects){
    const status=prospect.stage?.trim()||'Sans statut';
    statusTotals.set(status,(statusTotals.get(status)??0)+1);
    const counts=statusByMember.get(prospect.assigned_to)??new Map<string,number>();
    counts.set(status,(counts.get(status)??0)+1);
    statusByMember.set(prospect.assigned_to,counts);
  }
  const configuredStatuses=PROSPECT_STAGES.map(stage=>stage.label);
  const statuses=[...new Set([...configuredStatuses,...statusTotals.keys()])];

  return <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6">
    <header className="mb-6"><div><p className="text-xs font-bold uppercase tracking-wider">{isAdmin?'Administration':'Espace manager'}</p><h1 className="font-display text-3xl font-bold">{isAdmin?'KPI des équipes':'Mon équipe'}</h1></div></header>
    {isAdmin&&<div className="mb-6 flex flex-wrap items-end gap-3"><form action="/equipe" className="flex items-end gap-2"><label className="grid gap-1 text-sm font-semibold">Équipe<select name="team" defaultValue={selectedTeam?.id??''} className="h-10 min-w-56 rounded-lg border border-navy-200 bg-white px-3"><option value="">Tous les commerciaux</option>{teams?.map(t=><option key={t.id} value={t.id}>{t.name}{!t.is_active?' (désactivée)':''}</option>)}</select></label><button type="submit" className="h-10 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white disabled:opacity-50">Afficher</button></form><Link href="/admin/equipes" className="pb-2 text-sm font-semibold underline">Gérer les équipes</Link></div>}
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile label="Prospects actifs" value={fmtNombre(sum('actifs'))}/><KpiTile label="Actions en retard" value={fmtNombre(sum('retards'))}/><KpiTile label="Dossiers en cours" value={fmtNombre(sum('encours'))}/><KpiTile label="Dossiers validés ADV" value={fmtNombre(sum('valides'))}/>
    </div>
    <Card className="overflow-x-auto"><table className="w-full min-w-[50rem] text-left text-sm"><thead><tr>{['Commercial / responsable','Équipe','Prospects actifs','Actions en retard','Dossiers en cours','Validés ADV'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>
      {rows.map(row=><tr key={row.id} className="border-b border-navy-100"><td className="px-4 py-3 font-semibold">{row.full_name}{row.role==='manager'&&<span className="ml-2 text-xs text-grey-brand">Responsable</span>}{!row.is_active&&<span className="ml-2 text-xs text-grey-brand">Désactivé</span>}</td><td className="px-4 py-3">{row.role==='manager'?(teams??[]).filter(t=>t.manager_id===row.id&&(!selectedTeam||t.id===selectedTeam.id)).map(t=>t.name).join(', ')||'—':row.partner_team_id?teamNames.get(row.partner_team_id)??'—':'—'}</td><td className="px-4 py-3">{row.actifs}</td><td className="px-4 py-3">{row.retards}</td><td className="px-4 py-3">{row.encours}</td><td className="px-4 py-3">{row.valides}</td></tr>)}
      {rows.length>0&&<tr className="font-bold"><td className="px-4 py-3">Total équipes</td><td/><td className="px-4 py-3">{sum('actifs')}</td><td className="px-4 py-3">{sum('retards')}</td><td className="px-4 py-3">{sum('encours')}</td><td className="px-4 py-3">{sum('valides')}</td></tr>}
    </tbody></table>{!rows.length&&<p className="p-6 text-sm text-grey-brand">Aucun commercial à afficher.</p>}</Card>
    <section className="mt-8 space-y-4" aria-labelledby="statuts-prospection">
      <h2 id="statuts-prospection" className="font-display text-xl font-bold">Statuts de prospection</h2>
      {statuses.length>0?<>
      <Card className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th scope="col" className="whitespace-nowrap px-4 py-3">Commercial</th>{statuses.map(status=><th scope="col" key={status} className="whitespace-nowrap px-4 py-3">{status}</th>)}<th scope="col" className="px-4 py-3">Total</th></tr></thead><tbody>
      {rows.map(row=>{const counts=statusByMember.get(row.id);return <tr key={row.id} className="border-b border-navy-100"><th scope="row" className="whitespace-nowrap px-4 py-3 font-semibold">{row.full_name}{row.role==='manager'&&<span className="ml-2 text-xs text-grey-brand">Responsable</span>}{!row.is_active&&<span className="ml-2 text-xs text-grey-brand">Désactivé</span>}</th>{statuses.map(status=><td key={status} className="px-4 py-3">{fmtNombre(counts?.get(status)??0)}</td>)}<td className="px-4 py-3 font-semibold">{fmtNombre([...counts?.values()??[]].reduce((a,b)=>a+b,0))}</td></tr>})}
      <tr className="font-bold"><th scope="row" className="px-4 py-3">Total équipe</th>{statuses.map(status=><td key={status} className="px-4 py-3">{fmtNombre(statusTotals.get(status)??0)}</td>)}<td className="px-4 py-3">{fmtNombre(prospects.length)}</td></tr>
      </tbody></table></Card></>:<p className="text-sm text-grey-brand">Aucun lead attribué aux commerciaux affichés.</p>}
    </section>
    {isAdmin&&<section className="mt-8 space-y-4" aria-labelledby="commentaires-equipe"><h2 id="commentaires-equipe" className="font-display text-xl font-bold">Commentaires des prospects</h2><p className="text-sm text-grey-brand">Dernier commentaire enregistré par prospect · 100 prospects maximum, classés par dernière activité.</p><Card><div className="divide-y divide-navy-100">{commented.map(p=><article key={p.id} className="space-y-1 px-4 py-4"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><Link href={`/prospection/${p.id}`} className="font-semibold underline">{p.raison_sociale||nomComplet(p.nom,p.prenom)||'Prospect'}</Link><span className="text-sm text-grey-brand">Attribué à : {team.find(m=>m.id===p.assigned_to)?.full_name??'—'}</span>{p.last_action_at&&<span className="text-xs text-grey-brand">Dernière activité : {fmtDateHeure(p.last_action_at)}</span>}</div><p className="whitespace-pre-wrap break-words text-sm">{p.notes}</p></article>)}{!commented.length&&<p className="p-5 text-sm text-grey-brand">Aucun commentaire sur les prospects affichés.</p>}</div></Card></section>}
  </main>;
}
