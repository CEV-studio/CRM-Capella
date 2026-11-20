import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PiecesJointes } from '@/components/pieces-jointes';
import type { PieceJointe } from '@/lib/domain/database.types';

/** Operational detail without sales, assignment or administration controls. */
export async function AdvRecord({id,scope}:{id:string;scope:'prospect'|'affaire'}){
 const db=await createClient();
 const {data:record}=await db.from(scope==='prospect'?'prospects':'affaires').select('*').eq('id',id).is('deleted_at',null).maybeSingle();
 if(!record)notFound();
 const row=record as Record<string,unknown>;
 const prospectId=scope==='prospect'?id:row.prospect_id as string|null;
 const filter=scope==='prospect'?`prospect_id.eq.${id}`:prospectId?`affaire_id.eq.${id},prospect_id.eq.${prospectId}`:`affaire_id.eq.${id}`;
 const [{data:pieces},{data:meters},{data:dossier},{data:contacts},{data:contracts}]=await Promise.all([
  db.from('pieces_jointes').select('*').or(filter).order('created_at'),
  prospectId?db.from('prospect_compteurs').select('*').eq('prospect_id',prospectId):Promise.resolve({data:[]}),
  prospectId?db.from('partner_dossiers').select('id').eq('prospect_id',prospectId).maybeSingle():Promise.resolve({data:null}),
  prospectId?db.from('prospect_contacts').select('*').eq('prospect_id',prospectId):Promise.resolve({data:[]}),
  typeof row.entreprise_id==='string'?db.from('contrats_energie').select('*').eq('entreprise_id',row.entreprise_id).is('archived_at',null):Promise.resolve({data:[]}),
 ]);
 const fields:Record<string,string>={ref:'Référence',stage:'Statut',siren:'SIREN',nom:'Nom',prenom:'Prénom',mail:'Email',telephone:'Téléphone',tel_mobile:'Mobile',tel_fixe:'Téléphone fixe',adresse_entreprise:'Adresse',adresse_conso:'Adresse de consommation',code_postal:'Code postal',ville:'Ville',pdl:'PDL',pce:'PCE',pdl_elec:'PDL',pce_gaz:'PCE',fournisseur:'Fournisseur',fournisseur_electricite:'Fournisseur électricité',fournisseur_gaz:'Fournisseur gaz',date_fin_contrat:'Fin de contrat',date_debut:'Début de contrat',date_echeance:'Échéance',date_signature:'Signature',date_relance:'Relance',commission:'Commission',notes:'Notes'};
 const docs=(pieces??[]) as PieceJointe[];
 return <main className="mx-auto max-w-6xl space-y-6 px-6 py-8"><Link href="/adv" className="text-sm underline">← Dossiers ADV</Link><h1 className="text-2xl font-bold">{String(row.raison_sociale??row.ref??'Dossier')}</h1><dl className="grid gap-4 rounded-xl bg-white p-5 sm:grid-cols-2">{Object.entries(fields).filter(([key])=>row[key]!==null&&row[key]!==undefined&&row[key]!=='').map(([key,label])=><div key={key}><dt className="text-xs text-grey-brand">{label}</dt><dd className="whitespace-pre-wrap text-sm">{String(row[key])}</dd></div>)}</dl>{dossier?<Link className="block underline" href={`/partenaires/dossiers/${dossier.id}`}>Dossier apporteur</Link>:null}{scope==='affaire'&&prospectId?<Link className="block underline" href={`/prospection/${prospectId}`}>Informations et compteurs du client</Link>:null}{(meters??[]).length?<section className="rounded-xl bg-white p-5"><h2 className="font-bold">Compteurs</h2>{(meters??[]).map(m=><p key={m.id} className="mt-2 text-sm">{m.type_energie} · {m.numero} · {m.adresse} {m.code_postal} {m.ville} · {m.date_echeance}</p>)}</section>:null}{(contacts??[]).length?<section className="rounded-xl bg-white p-5"><h2 className="font-bold">Contacts</h2>{(contacts??[]).map(c=><p key={c.id} className="mt-2 text-sm">{c.prenom} {c.nom} · {c.fonction} · {c.email} · {c.telephone}</p>)}</section>:null}{(contracts??[]).length?<section className="rounded-xl bg-white p-5"><h2 className="font-bold">Contrats d’énergie</h2>{(contracts??[]).map(c=><p key={c.id} className="mt-2 text-sm">{c.fournisseur} · {c.reference_contrat} · {c.date_debut} → {c.date_fin} · {c.prix} {c.unite_prix} · {c.consommation_mwh} MWh · {c.notes}</p>)}</section>:null}<PiecesJointes scope={scope} parentId={id} pieces={docs.filter(p=>scope==='prospect'?p.prospect_id===id:p.affaire_id===id)} heritees={docs.filter(p=>scope==='affaire'&&p.affaire_id!==id)}/></main>;
}
