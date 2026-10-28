import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { QualityForm } from '../nouveau-form';
export const metadata={title:'Nouveau contrôle qualité — Capella CRM'};
export default async function NewMegaQualityPage(){const profile=await requireProfile();if(!['admin','qualite'].includes(profile.role))redirect('/?motif=acces-refuse');return <main className="mx-auto max-w-5xl space-y-5 px-6 py-8"><Link href="/qualite" className="text-sm text-star-600 underline">← Tous les contrôles</Link><header><h1 className="font-display text-2xl font-bold text-navy-900">Nouveau contrôle qualité</h1><p className="mt-1 text-sm text-grey-brand">Contrôleur : {profile.full_name} · la date et l’heure sont enregistrées automatiquement.</p></header><QualityForm/></main>;}
