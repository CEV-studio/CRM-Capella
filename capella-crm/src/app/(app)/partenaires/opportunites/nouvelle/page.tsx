import {partnerContext} from '@/lib/partners/server';
import {OpportunityForm} from '@/components/partner-forms';
export default async function Page(){await partnerContext();return <main className="mx-auto max-w-6xl space-y-5 px-6 py-8"><h1 className="text-2xl font-bold">Nouvelle opportunité</h1><p className="text-sm text-grey-brand">Renseignez l’entreprise, le signataire et les compteurs, puis joignez les factures pour demander l’ACD.</p><OpportunityForm/></main>;}
