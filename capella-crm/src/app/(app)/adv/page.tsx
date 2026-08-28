import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdvRow } from "./adv-row";
import type { Affaire, Profile } from "@/lib/domain/database.types";

export const metadata={title:"ADV — Capella CRM"};export const dynamic="force-dynamic";
export default async function AdvPage(){
 const profil=await requireProfile();if(profil.role!=="admin")notFound();const supabase=await createClient();const [{data:affaires,error},{data:profils}]=await Promise.all([supabase.from("affaires").select("id, ref, raison_sociale, commercial_id, stage, commission, date_signature, date_entree").is("deleted_at",null).order("date_entree",{ascending:false}),supabase.from("profiles").select("id, full_name, commission_rate").eq("is_active",true)]);
 const map=new Map(((profils??[]) as Pick<Profile,"id"|"full_name"|"commission_rate">[]).map(p=>[p.id,p]));
 const lignes=((affaires??[]) as Affaire[]).map(a=>{const p=map.get(a.commercial_id);return{id:a.id,ref:a.ref,raison_sociale:a.raison_sociale,stage:a.stage,commission:Number(a.commission??0),date_signature:a.date_signature,commercial:p?.full_name??"—",taux:Number(p?.commission_rate??0)}});
 return <main className="w-full px-6 py-8"><header className="mb-5"><h1 className="font-display text-2xl font-bold text-navy-800">ADV</h1><p className="mt-1 text-sm text-grey-brand">Toutes les demandes de cotation. Valide le statut final et renseigne ici la commission globale réellement encaissée par Capella.</p></header>{error?<p className="mb-4 text-sm text-red-700">{error.message}</p>:null}<section className="overflow-x-auto rounded-xl border border-navy-100 bg-white"><div className="grid min-w-[1100px] grid-cols-[1.1fr_1.4fr_1fr_1fr_1fr_1fr_auto] gap-2 bg-navy-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-navy-200"><span>Dossier</span><span>Commercial</span><span>Statut</span><span>Commission globale</span><span>Commission commercial</span><span>Date signature</span><span>Action</span></div><div className="min-w-[1100px]">{lignes.length?lignes.map(a=><AdvRow key={a.id} a={a}/>):<p className="p-8 text-center text-sm text-grey-brand">Aucune cotation.</p>}</div></section></main>;
}
