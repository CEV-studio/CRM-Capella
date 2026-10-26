import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { centreNames } from '@/lib/belgium/centre-accounts';
import { Card,CardHeader } from '@/components/ui';
import { ColorBadge } from '../../belgique/badges';
import { CreerCentreForm,GestionCentre } from './forms';
export const dynamic='force-dynamic';
export const metadata={title:'Comptes centres et agents — Capella CRM'};
export default async function CentresPage(){
 await requireAdmin();const db=await createClient();
 const [centres,profiles,access]=await Promise.all([centreNames(db),db.from('profiles').select('id,full_name,email,is_active,must_change_password,role').in('role',['be_centre','be_agent']).order('full_name'),db.from('be_access').select('*')]);
 if(profiles.error||access.error)throw new Error('Lecture des comptes centres impossible.');
 return <main className="mx-auto max-w-5xl space-y-6 px-6 py-8"><header className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-100 to-indigo-50 p-5"><h1 className="font-display text-2xl font-bold text-navy-800">Comptes centres et agents</h1></header><Card><CardHeader title="Créer un compte"/><CreerCentreForm centres={centres}/></Card><Card><CardHeader title={`Comptes centres et agents · ${profiles.data?.length||0}`}/><div className="divide-y divide-navy-100">{profiles.data?.map(p=>{const a=access.data?.find(a=>a.user_id===p.id);return <article key={p.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-navy-800">{p.full_name}</h2><p className="text-sm text-grey-brand">{p.email}</p></div><div className="flex flex-wrap gap-2"><ColorBadge label={p.role==='be_agent'?'Agent':'Responsable centre'} tone="sky"/>{a?.agent_ref&&<ColorBadge label={a.agent_ref} tone="slate"/>}<ColorBadge label={a?.centre||'Centre non affecté'} tone="indigo"/><ColorBadge label={p.is_active&&a?.is_active?'Actif':'Désactivé'} tone={p.is_active&&a?.is_active?'emerald':'slate'}/>{p.must_change_password&&<ColorBadge label="Mot de passe à changer" tone="amber"/>}</div></div><GestionCentre id={p.id} active={p.is_active}/></article>})}{!profiles.data?.length&&<p className="p-5 text-sm text-grey-brand">Aucun compte centre ou agent.</p>}</div></Card></main>;
}
