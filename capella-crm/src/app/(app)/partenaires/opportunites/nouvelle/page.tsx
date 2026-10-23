import {partnerContext} from '@/lib/partners/server';
import {OpportunityForm} from '@/components/partner-forms';
export default async function Page(){await partnerContext();return <main className="mx-auto max-w-6xl space-y-5 px-6 py-8"><h1 className="text-2xl font-bold">Nouvelle opportunité</h1><OpportunityForm/></main>;}
