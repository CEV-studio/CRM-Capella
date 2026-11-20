import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { deliverNotifications } from "@/lib/partners/notifications";
import { requireAdv } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request:Request,{params}:{params:Promise<{requestId:string}>}) {
  const profile=await requireAdv();
  const {requestId}=await params;
  const body=await request.json().catch(()=>({})) as {status?:string};
  if (!["a_traiter","en_cours","envoyee","terminee","annulee"].includes(body.status||"")) return NextResponse.json({error:"Statut invalide."},{status:400});
  const supabase=await createClient();
  const db=supabase;
  const {data:acd,error:acdError}=await db.from("acd_requests").select("id,prospect_id").eq("id",requestId).maybeSingle();
  if(acdError)return NextResponse.json({error:acdError.message},{status:400});
  if(!acd)return NextResponse.json({error:"Demande ACD introuvable."},{status:404});

  const {error}=await db.rpc("adv_acd_status",{p_id:requestId,p_status:body.status!});
  if(error)return NextResponse.json({error:error.message},{status:400});
  await deliverNotifications(profile);
  revalidatePath("/partenaires","layout");
  revalidatePath("/admin/acd");
  revalidatePath("/adv");
  revalidatePath("/clients");
  revalidatePath("/conversion");
  revalidatePath(`/prospection/${acd.prospect_id}`);
  return NextResponse.json({ok:true});
}
