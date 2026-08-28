import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdvRow } from "./adv-row";
import { fmtEuros } from "@/lib/format";
import type { Affaire, Profile } from "@/lib/domain/database.types";

export const metadata={title:"ADV — Capella CRM"};
export const dynamic="force-dynamic";

type Recherche={q?:string;statut?:string;commercial?:string};

export default async function AdvPage({searchParams}:{searchParams:Promise<Recherche>}){
 const profil=await requireProfile();
 if(profil.role!=="admin")notFound();
 const filtres=await searchParams;
 const supabase=await createClient();
 const [{data:affaires,error},{data:profils}]=await Promise.all([
  supabase.from("affaires").select("id, ref, raison_sociale, commercial_id, stage, commission, date_signature, date_entree").is("deleted_at",null).order("date_entree",{ascending:false}),
  supabase.from("profiles").select("id, full_name, commission_rate").eq("is_active",true).order("full_name"),
 ]);

 const listeProfils=((profils??[]) as Pick<Profile,"id"|"full_name"|"commission_rate">[]);
 const map=new Map(listeProfils.map(p=>[p.id,p]));
 const toutes=((affaires??[]) as Affaire[]).map(a=>{const p=map.get(a.commercial_id);return{id:a.id,ref:a.ref,raison_sociale:a.raison_sociale,stage:a.stage,commission:Number(a.commission??0),date_signature:a.date_signature,commercial:p?.full_name??"—",commercialId:a.commercial_id,taux:Number(p?.commission_rate??0)}});

 const q=(filtres.q??"").trim().toLowerCase();
 const statut=filtres.statut??"a_traiter";
 const lignes=toutes.filter(a=>{
  if(q&&!`${a.raison_sociale} ${a.ref??""} ${a.commercial}`.toLowerCase().includes(q))return false;
  if(filtres.commercial&&a.commercialId!==filtres.commercial)return false;
  if(statut==="signes"&&a.stage!=="Signé")return false;
  if(statut==="ko"&&a.stage!=="KO")return false;
  if(statut==="a_traiter"&&(a.stage==="Signé"||a.stage==="KO"))return false;
  return true;
 });

 const aTraiter=toutes.filter(a=>a.stage!=="Signé"&&a.stage!=="KO");
 const signees=toutes.filter(a=>a.stage==="Signé");
 const commissionsAttente=aTraiter.reduce((s,a)=>s+Number(a.commission||0),0);
 const commissionsValidees=signees.reduce((s,a)=>s+Number(a.commission||0),0);

 function url(s:string){const p=new URLSearchParams();if(filtres.q)p.set("q",filtres.q);if(filtres.commercial)p.set("commercial",filtres.commercial);p.set("statut",s);return `/adv?${p.toString()}`;}
 const chip=(key:string,label:string,n:number)=> <Link href={url(key)} className={statut===key?"rounded-full bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white":"rounded-full border border-navy-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700"}>{label} <span className="ml-1 opacity-70">{n}</span></Link>;

 return <main className="w-full px-6 py-8">
  <header className="mb-5"><h1 className="font-display text-2xl font-bold text-navy-800">ADV</h1><p className="mt-1 text-sm text-grey-brand">Vue opérationnelle des cotations : traite d’abord les dossiers en attente, puis retrouve les dossiers signés ou KO via les filtres.</p></header>

  <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <div className="rounded-xl border border-navy-100 bg-white p-4"><div className="text-xs text-grey-brand">À traiter</div><div className="mt-1 text-2xl font-bold text-navy-800">{aTraiter.length}</div></div>
   <div className="rounded-xl border border-navy-100 bg-white p-4"><div className="text-xs text-grey-brand">Commission en attente</div><div className="mt-1 text-2xl font-bold text-amber-700">{fmtEuros(commissionsAttente)}</div></div>
   <div className="rounded-xl border border-navy-100 bg-white p-4"><div className="text-xs text-grey-brand">Dossiers signés</div><div className="mt-1 text-2xl font-bold text-green-700">{signees.length}</div></div>
   <div className="rounded-xl border border-navy-100 bg-white p-4"><div className="text-xs text-grey-brand">Commission validée</div><div className="mt-1 text-2xl font-bold text-navy-800">{fmtEuros(commissionsValidees)}</div></div>
  </div>

  <section className="mb-5 rounded-xl border border-navy-100 bg-white p-4">
   <div className="mb-3 flex flex-wrap gap-2">{chip("a_traiter","À traiter",aTraiter.length)}{chip("signes","Signés",signees.length)}{chip("ko","KO",toutes.filter(a=>a.stage==="KO").length)}{chip("tous","Tous",toutes.length)}</div>
   <form method="get" className="flex flex-wrap gap-2">
    <input type="hidden" name="statut" value={statut}/>
    <input type="search" name="q" defaultValue={filtres.q??""} placeholder="Entreprise, référence, commercial…" className="h-9 min-w-64 flex-1 rounded-lg border border-navy-200 px-3 text-sm"/>
    <select name="commercial" defaultValue={filtres.commercial??""} className="h-9 rounded-lg border border-navy-200 bg-white px-3 text-sm"><option value="">Tous les commerciaux</option>{listeProfils.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
    <button className="h-9 rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white">Filtrer</button>
   </form>
  </section>

  {error?<p className="mb-4 text-sm text-red-700">{error.message}</p>:null}
  {lignes.length?<section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{lignes.map(a=><AdvRow key={a.id} a={a}/>)}</section>:<div className="rounded-xl border border-dashed border-navy-200 bg-white p-10 text-center text-sm text-grey-brand">Aucun dossier dans cette vue.</div>}
 </main>;
}
