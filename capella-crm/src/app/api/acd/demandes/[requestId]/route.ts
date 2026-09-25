import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { deliverNotifications } from "@/lib/partners/notifications";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request:Request,{params}:{params:Promise<{requestId:string}>}) {
  const profile=await requireAdmin();
  const {requestId}=await params;
  const body=await request.json().catch(()=>({})) as {status?:string};
  if (!["a_traiter","en_cours","terminee","annulee"].includes(body.status||"")) return NextResponse.json({error:"Statut invalide."},{status:400});
  const supabase=await createClient();
  const db=supabase as any;
  const {data:acd,error:acdError}=await db.from("acd_requests").select("id,prospect_id").eq("id",requestId).maybeSingle();
  if(acdError)return NextResponse.json({error:acdError.message},{status:400});
  if(!acd)return NextResponse.json({error:"Demande ACD introuvable."},{status:404});

  const {data:partner}=await supabase.from("partner_dossiers").select("id").eq("acd_request_id",requestId).maybeSingle();
  if(body.status==="terminee" && !partner){
    const {data:prospect,error:prospectError}=await db.from("prospects").select("*").eq("id",acd.prospect_id).is("deleted_at",null).maybeSingle();
    if(prospectError)return NextResponse.json({error:prospectError.message},{status:400});
    if(!prospect)return NextResponse.json({error:"Prospect associé introuvable."},{status:404});

    const {data:affaire,error:affaireLookupError}=await db.from("affaires").select("id").eq("prospect_id",prospect.id).is("deleted_at",null).limit(1).maybeSingle();
    if(affaireLookupError)return NextResponse.json({error:affaireLookupError.message},{status:400});
    if(!affaire){
      const raisonSociale=prospect.raison_sociale??([prospect.prenom,prospect.nom].filter(Boolean).join(" ")||"(sans nom)");
      const {error:affaireError}=await db.from("affaires").insert({
        commercial_id:prospect.assigned_to??profile.id,
        prospect_id:prospect.id,
        source_id:prospect.source_id,
        raison_sociale:raisonSociale,
        siren:prospect.siren,
        nom:prospect.nom,
        prenom:prospect.prenom,
        mail:prospect.mail,
        telephone:prospect.tel_mobile??prospect.tel_fixe,
        pdl_elec:prospect.pdl,
        pce_gaz:prospect.pce,
        fournisseur:prospect.fournisseur_electricite??prospect.fournisseur_gaz,
        date_echeance:prospect.date_fin_contrat,
        sans_engagement:prospect.sans_engagement,
        notes:prospect.notes,
        stage:"Demande de cotation",
        created_by:profile.id,
      });
      if(affaireError)return NextResponse.json({error:`Création de la demande de cotation impossible : ${affaireError.message}`},{status:400});
    }

    const now=new Date().toISOString();
    const {error:stageError}=await db.from("prospects").update({stage:"Demande de cotation",entered_conversion_at:now,last_action_at:now}).eq("id",prospect.id);
    if(stageError)return NextResponse.json({error:`La cotation a été créée, mais le prospect n’a pas pu être déplacé : ${stageError.message}`},{status:400});
  }

  const patch={status:body.status,processed_by:profile.id,processed_at:["terminee","annulee"].includes(body.status||"")?new Date().toISOString():null};
  const {error}=await db.from("acd_requests").update(patch).eq("id",requestId);
  if(error) return NextResponse.json({error:error.message},{status:400});
  if(partner)await deliverNotifications(profile);
  revalidatePath("/partenaires","layout");
  revalidatePath("/admin/acd");
  revalidatePath("/adv");
  revalidatePath("/clients");
  revalidatePath("/conversion");
  revalidatePath(`/prospection/${acd.prospect_id}`);
  return NextResponse.json({ok:true});
}
