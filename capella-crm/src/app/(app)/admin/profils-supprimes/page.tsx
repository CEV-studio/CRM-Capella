import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader } from '@/components/ui';
import { ProfilCorbeilleButton } from '@/components/profil-corbeille-button';

export const dynamic='force-dynamic';
export const metadata={title:'Profils supprimés — Capella CRM'};
export default async function ProfilsSupprimesPage() {
 await requireAdmin(); const db=await createClient();
 const {data,error}=await db.from('profiles').select('id,full_name,email,role,archived_at').not('archived_at','is',null).order('archived_at',{ascending:false});
 if(error) throw new Error('Impossible de charger les profils supprimés.');
 return <main className="mx-auto max-w-5xl space-y-6 px-6 py-8"><header><h1 className="font-display text-2xl font-bold">Profils supprimés</h1><Link href="/admin/commerciaux" className="text-sm underline">Retour aux comptes</Link></header>
 <Card><CardHeader title={`Corbeille · ${data?.length??0}`}/><div className="divide-y divide-navy-100">{data?.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-semibold">{p.full_name}</p><p className="text-sm text-grey-brand">{p.email} · {p.role}</p></div><ProfilCorbeilleButton id={p.id} nom={p.full_name} restaurer/></div>)}{!data?.length&&<p className="p-5 text-sm">Aucun profil supprimé.</p>}</div></Card></main>;
}
