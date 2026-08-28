import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KpiTile } from "@/components/ui";
import { AFFAIRE_STAGES, stageColor } from "@/lib/domain/stages";
import { fmtEuros } from "@/lib/format";
import { Carte, type CarteAffaire } from "./carte";
import { chargerApporteurs } from "@/lib/referentiels";
import type { Affaire } from "@/lib/domain/database.types";

export const metadata={title:"Cotations — Capella CRM"}; export const dynamic="force-dynamic"; const CARTES_PAR_COLONNE=40;
export default async function ConversionPage(){
 const profil=await requireProfile(); const supabase=await createClient();
 const [{data:affairesBrutes,error},apporteurs]=await Promise.all([
   supabase.from("affaires").select("id, ref, commercial_id, apporteur_id, raison_sociale, type_energie, stage, date_signature, date_relance, commission").is("deleted_at",null).eq("commercial_id",profil.id).order("date_entree",{ascending:false}),
   chargerApporteurs(),
 ]);
 const nomApporteur=new Map(apporteurs.map(a=>[a.id,a.name])); const affaires:CarteAffaire[]=((affairesBrutes??[]) as Affaire[]).map(a=>({...a,commercial:profil.full_name,apporteur:a.apporteur_id?(nomApporteur.get(a.apporteur_id)??null):null}));
 const parEtape=new Map<string,CarteAffaire[]>(AFFAIRE_STAGES.map(s=>[s.label,[]]));for(const a of affaires)parEtape.get(a.stage)?.push(a);
 const signees=affaires.filter(a=>a.stage==="Signé"); const globalSigne=signees.reduce((s,a)=>s+Number(a.commission??0),0); const maCommission=globalSigne*Number(profil.commission_rate??0); const enCours=affaires.filter(a=>a.stage!=="Signé"&&a.stage!=="KO"); const taux=affaires.length?signees.length/affaires.length:0;
 return <main className="w-full px-6 py-8"><header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-bold text-navy-800">Mes cotations</h1><p className="mt-1 text-sm text-grey-brand">Tes clients passés en Demande de cotation. Le statut « Signé » et la commission globale sont validés par l’ADV.</p></div><Link href="/clients" className="inline-flex h-10 items-center rounded-lg border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-700">← Clients</Link></header>
 <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiTile label="Signées" value={String(signees.length)}/><KpiTile label="Ma commission" value={fmtEuros(maCommission)} hint={`Taux ${(Number(profil.commission_rate)*100).toFixed(0)} %`}/><KpiTile label="En cours" value={String(enCours.length)}/><KpiTile label="Taux de conversion" value={`${(taux*100).toFixed(1).replace(".",",")} %`}/></div>
 {error?<p className="text-sm text-red-700">Lecture impossible : {error.message}</p>:null}
 <div className="scroll-slim overflow-x-auto pb-3"><div className="flex min-w-max gap-4">{AFFAIRE_STAGES.map(etape=>{const cartes=parEtape.get(etape.label)??[];return <section key={etape.label} className="w-64 shrink-0"><header className="flex items-center justify-between rounded-t-lg px-3 py-2" style={{backgroundColor:stageColor(etape.label,"affaire")}}><h2 className="text-sm font-semibold text-navy-800">{etape.label}</h2><span className="tabular rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-navy-800">{cartes.length}</span></header><ul className="min-h-24 space-y-2 rounded-b-lg border border-navy-100 bg-navy-50 p-2">{cartes.length===0?<li className="px-2 py-6 text-center text-xs text-grey-brand">Aucune cotation</li>:cartes.slice(0,CARTES_PAR_COLONNE).map(a=><Carte key={a.id} a={a} afficherCommercial={false} commissionRate={Number(profil.commission_rate)}/>)}</ul></section>;})}</div></div></main>;
}
