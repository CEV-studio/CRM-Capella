import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { loadBelgiumProduction } from '@/lib/belgium/server';
import { Card,CardHeader } from '@/components/ui';
import { ColorBadge } from '../badges';
import { EncodageForm } from './form';
export const metadata={title:'Encoder une vente — Capella CRM'};
export default async function EncoderPage(){
 const profile=await requireProfile();if(!['be_agent','be_centre'].includes(profile.role))redirect('/belgique');
 const db=await createClient();
 const [{encoding},{data:products,error},agentsResult]=await Promise.all([loadBelgiumProduction(),db.from('be_products').select('*').eq('is_active',true).order('sort_order').order('label'),profile.role==='be_centre'?db.rpc('be_centre_agents') : Promise.resolve({data:null,error:null})]);
 if(error||agentsResult.error)throw new Error('Lecture des produits ou agents impossible.');
 return <main className="mx-auto max-w-4xl space-y-6 px-6 py-8"><header className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-100 to-indigo-50 p-5"><h1 className="font-display text-2xl font-bold text-navy-800">Encoder une vente</h1><div className="mt-3 flex flex-wrap gap-2"><ColorBadge label={'Encodé par : '+profile.full_name} tone="indigo"/>{encoding&&<ColorBadge label={encoding.centre} tone="sky"/>}<ColorBadge label="Signé" tone="emerald"/></div></header><Card><CardHeader title="Informations client et contrat"/>{profile.role==='be_centre'?(agentsResult.data?.length?<EncodageForm products={products||[]} submissionId={randomUUID()} agents={agentsResult.data}/>:<p className="p-5 text-rose-900">Aucun agent actif dans votre centre.</p>):encoding?<EncodageForm products={products||[]} submissionId={randomUUID()}/>:<p className="p-5 text-rose-900">Aucun centre actif affecté à ce compte.</p>}</Card></main>;
}
