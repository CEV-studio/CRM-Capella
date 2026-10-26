import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card,CardHeader } from '@/components/ui';
import { ColorBadge } from '../../belgique/badges';
import { CreerProduitForm,ActivationProduit } from './forms';
export const metadata={title:'Produits — Capella CRM'};
export const dynamic='force-dynamic';
export default async function ProduitsPage(){
 await requireAdmin();const db=await createClient();const {data,error}=await db.from('be_products').select('*').order('sort_order').order('label');
 if(error)throw new Error('Lecture du catalogue impossible.');
 return <main className="mx-auto max-w-4xl space-y-6 px-6 py-8"><header className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-100 to-indigo-50 p-5"><h1 className="font-display text-2xl font-bold text-navy-800">Produits d’encodage</h1></header><Card><CardHeader title="Ajouter un produit"/><CreerProduitForm/></Card><Card><CardHeader title="Produits disponibles"/><div className="divide-y">{data.map(p=><article key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="font-semibold">{p.label}</h2><p className="text-sm text-grey-brand">{{energy:'Énergie',telecom:'Télécom',other:'Autre'}[p.kind]}{p.supplier?' · '+p.supplier:''}</p></div><ColorBadge label={p.is_active?'Actif':'Désactivé'} tone={p.is_active?'emerald':'slate'}/><ActivationProduit id={p.id} active={p.is_active}/></article>)}</div></Card></main>;
}
