import Link from "next/link";
import { notFound } from "next/navigation";
import { peutGerer, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StageBadge } from "@/components/ui";
import { stageColor } from "@/lib/domain/stages";
import { fmtDate } from "@/lib/format";
import { BoutonSupprimer } from "../../admin/corbeille/bouton-supprimer";
import { PiecesJointes } from "@/components/pieces-jointes";
import { AffaireForm } from "../affaire-form";
import { chargerApporteurs } from "@/lib/referentiels";
import type { Affaire, PieceJointe, Profile, Prospect } from "@/lib/domain/database.types";

export const dynamic="force-dynamic";
export default async function FicheAffairePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const profil=await requireProfile();const estAdmin=profil.role==="admin";const supabase=await createClient();const {data:affaire}=await supabase.from("affaires").select("*").eq("id",id).is("deleted_at",null).maybeSingle();if(!affaire)notFound();const a=affaire as Affaire;
 const [apporteurs,{data:profils},{data:origine},{data:piecesData}]=await Promise.all([chargerApporteurs(),estAdmin?supabase.from("profiles").select("id, full_name").eq("is_active",true).order("full_name"):Promise.resolve({data:[] as Pick<Profile,"id"|"full_name">[]}),a.prospect_id?supabase.from("prospects").select("id, ref, raison_sociale").eq("id",a.prospect_id).is("deleted_at",null).maybeSingle():Promise.resolve({data:null}),supabase.from("pieces_jointes").select("*").or(a.prospect_id?`affaire_id.eq.${a.id},prospect_id.eq.${a.prospect_id}`:`affaire_id.eq.${a.id}`).order("created_at")]);
 const prospect=origine as Pick<Prospect,"id"|"ref"|"raison_sociale">|null;const toutesPieces=(piecesData??[]) as PieceJointe[];const piecesAffaire=toutesPieces.filter(p=>p.affaire_id===a.id);const piecesHeritees=toutesPieces.filter(p=>p.affaire_id!==a.id&&p.prospect_id===a.prospect_id);
 return <main className="mx-auto w-full max-w-5xl px-6 py-8"><Link href="/conversion" className="text-sm text-grey-brand underline">← Retour à mes cotations</Link><header className="mt-3 mb-6"><h1 className="font-display text-2xl font-bold text-navy-800">{a.raison_sociale}</h1><div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-grey-brand"><StageBadge label={a.stage} color={stageColor(a.stage,"affaire")}/><span>{a.ref}</span><span>· entrée le {fmtDate(a.date_entree)}</span>{prospect?<span>· client <Link href={`/prospection/${prospect.id}`} className="text-star-600 underline">{prospect.ref}</Link></span>:null}</div>{peutGerer(profil)?<div className="mt-3"><BoutonSupprimer cible="affaire" id={a.id} libelle={a.raison_sociale} retour="/conversion"/></div>:null}</header><AffaireForm affaire={a} estAdmin={estAdmin} commissionRate={Number(profil.commission_rate)} apporteurs={apporteurs.filter(x=>x.is_active).map(x=>({value:x.id,label:x.name}))} commerciaux={(profils??[]).map(c=>({value:c.id,label:c.full_name}))}/><div className="mt-6"><PiecesJointes scope="affaire" parentId={a.id} pieces={piecesAffaire} heritees={piecesHeritees}/></div></main>;
}
