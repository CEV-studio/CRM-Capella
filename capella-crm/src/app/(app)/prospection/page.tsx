import Link from "next/link";
import { cookies } from "next/headers";
import { peutGerer, peutSupprimer, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { PROSPECTION_STAGES } from "@/lib/domain/stages";
import { normalizeDigits } from "@/lib/format";
import { Filtres } from "./filtres";
import { type LigneProspect } from "./ligne";
import { ListeProspects } from "./liste-prospects";
import { KanbanProspection } from "./kanban";
import { MemoVue } from "./memo-vue";
import { chargerSources, chargerEtapesProspect } from "@/lib/referentiels";
import type { Prospect, Profile } from "@/lib/domain/database.types";

export const metadata = { title: "Prospection — Capella CRM" };
export const dynamic = "force-dynamic";
const PAR_PAGE=50;
const TRIS={societe:{colonne:"raison_sociale",croissant:true,libelle:"Société"},action:{colonne:"last_action_at",croissant:false,libelle:"Dernière action"},relance:{colonne:"next_action_date",croissant:true,libelle:"Prochaine action"},etape:{colonne:"stage",croissant:true,libelle:"Étape"}} as const;
type CleTri=keyof typeof TRIS;
type Recherche={q?:string;etape?:string;categorie?:string;commercial?:string;source?:string;historique?:string;tri?:string;page?:string;vue?:string};

export default async function ProspectionPage({searchParams}:{searchParams:Promise<Recherche>}){
  const profil=await requireProfile(); const estAdmin=profil.role==="admin"; const filtres=await searchParams; const supabase=await createClient(); const db=supabase as any;
  const cleTri:CleTri=(filtres.tri??"action") in TRIS?(filtres.tri as CleTri)??"action":"action"; const tri=TRIS[cleTri]; const page=Math.max(1,Number(filtres.page??1)||1);
  let requete=db.from("prospects").select("id, ref, raison_sociale, nom, prenom, mail, tel_mobile, tel_fixe, siren, stage, next_action, next_action_date, notes, last_action_at, assigned_to, source_id, date_fin_contrat, legacy_sheet",{count:"exact"}).is("deleted_at",null).is("became_client_at",null);
  if(filtres.etape) requete=requete.eq("stage",filtres.etape); else if(filtres.categorie){const etapes=PROSPECTION_STAGES.filter(s=>s.category===filtres.categorie).map(s=>s.label);if(etapes.length)requete=requete.in("stage",etapes);}
  if(estAdmin&&filtres.commercial){if(filtres.commercial==="reservoir")requete=requete.is("assigned_to",null);else requete=requete.eq("assigned_to",filtres.commercial);} if(filtres.source)requete=requete.eq("source_id",filtres.source); if(filtres.historique)requete=requete.eq("legacy_sheet",filtres.historique);
  const q=(filtres.q??"").trim(); if(q){const chiffres=normalizeDigits(q);const motifs=[`raison_sociale.ilike.%${q}%`,`nom.ilike.%${q}%`,`prenom.ilike.%${q}%`,`mail.ilike.%${q}%`];if(chiffres)motifs.push(`siren_norm.like.%${chiffres}%`,`mobile_norm.like.%${chiffres}%`,`pdl_norm.like.%${chiffres}%`,`pce_norm.like.%${chiffres}%`);requete=requete.or(motifs.join(","));}
  const debut=(page-1)*PAR_PAGE;
  const [{data,count,error},{data:profils},sources,etapes]=await Promise.all([requete.order(tri.colonne,{ascending:tri.croissant,nullsFirst:false}).range(debut,debut+PAR_PAGE-1),estAdmin?supabase.from("profiles").select("id, full_name").order("full_name"):Promise.resolve({data:[] as Pick<Profile,"id"|"full_name">[]}),chargerSources(),chargerEtapesProspect()]);
  const autorisees=new Set(PROSPECTION_STAGES.map(s=>s.label)); const vuesRapides=etapes.filter(s=>s.quick_filter&&autorisees.has(s.label as any)).map(s=>s.label);
  const nomParCommercial=new Map((profils??[]).map(p=>[p.id,p.full_name])); const nomParSource=new Map(sources.map(s=>[s.id,s.name]));
  const lignes:LigneProspect[]=((data??[]) as Prospect[]).map(p=>({...p,commercial:p.assigned_to?(nomParCommercial.get(p.assigned_to)??"—"):null,source:p.source_id?(nomParSource.get(p.source_id)??null):null}));
  const total=count??0; const nbPages=Math.max(1,Math.ceil(total/PAR_PAGE)); const vuePreferee=(await cookies()).get("prospection_vue")?.value; const kanban=filtres.vue!==undefined?filtres.vue==="kanban":vuePreferee==="kanban";
  function lienVue(vue:"liste"|"kanban"){const p=new URLSearchParams(Object.entries(filtres).filter(([,v])=>v) as [string,string][]);p.set("vue",vue);p.delete("page");return `/prospection?${p.toString()}`;} function lienTri(cle:CleTri){const p=new URLSearchParams(Object.entries(filtres).filter(([,v])=>v) as [string,string][]);p.set("tri",cle);p.delete("page");return `/prospection?${p.toString()}`;} function lienPage(n:number){const p=new URLSearchParams(Object.entries(filtres).filter(([,v])=>v) as [string,string][]);p.set("page",String(n));return `/prospection?${p.toString()}`;}
  return <main className="w-full px-6 py-8"><MemoVue vue={kanban?"kanban":"liste"}/><header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-bold text-navy-800">Prospection</h1><p className="mt-1 text-sm text-grey-brand">{estAdmin?"Tous les prospects avant récupération des factures.":"Tes prospects jusqu'à la récupération des factures."}</p></div><div className="flex items-center gap-2"><div className="inline-flex rounded-lg border border-navy-200 p-0.5"><Link href={lienVue("liste")} className={!kanban?"rounded-md bg-navy-800 px-3 py-1.5 text-sm font-semibold text-white":"rounded-md px-3 py-1.5 text-sm font-semibold text-navy-700 hover:bg-navy-50"}>Liste</Link><Link href={lienVue("kanban")} className={kanban?"rounded-md bg-navy-800 px-3 py-1.5 text-sm font-semibold text-white":"rounded-md px-3 py-1.5 text-sm font-semibold text-navy-700 hover:bg-navy-50"}>Kanban</Link></div><Link href="/prospection/nouveau" className="inline-flex h-10 items-center rounded-lg bg-star-500 px-4 text-sm font-semibold text-white hover:bg-star-600">Nouveau prospect</Link></div></header>
  <div className="mb-4"><Filtres commerciaux={(profils??[]).map(p=>({value:p.id,label:p.full_name}))} sources={sources.filter(s=>s.is_active).map(s=>({value:s.id,label:s.name}))} total={total} vuesRapides={vuesRapides} peutPersonnaliser={peutGerer(profil)}/></div>
  {kanban?<KanbanProspection lignes={lignes} afficherCommercial={estAdmin} etapes={PROSPECTION_STAGES}/>:<Card className="overflow-hidden"><ListeProspects lignes={lignes} afficherCommercial={estAdmin} peutSupprimer={peutSupprimer(profil)} etapes={PROSPECTION_STAGES} triLiens={{societe:lienTri("societe"),etape:lienTri("etape"),relance:lienTri("relance"),action:lienTri("action")}} messageErreur={error?.message}/>{nbPages>1?<div className="flex items-center justify-between border-t border-navy-100 px-4 py-3 text-sm"><span className="tabular text-grey-brand">Page {page} sur {nbPages}</span><div className="flex gap-2">{page>1?<Link href={lienPage(page-1)} className="rounded-lg border border-navy-200 px-3 py-1.5 hover:bg-navy-50">Précédent</Link>:null}{page<nbPages?<Link href={lienPage(page+1)} className="rounded-lg border border-navy-200 px-3 py-1.5 hover:bg-navy-50">Suivant</Link>:null}</div></div>:null}</Card>}
  <p className="mt-4 text-xs text-grey-brand">Passer une fiche en « Demande ACD » la fait automatiquement quitter Prospection pour Clients.</p></main>;
}
