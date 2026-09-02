import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request:Request,{params}:{params:Promise<{requestId:string}>}) {
  const profile=await requireAdmin();
  const {requestId}=await params;
  const body=await request.json().catch(()=>({})) as {status?:string};
  if (!["a_traiter","en_cours","terminee","annulee"].includes(body.status||"")) return NextResponse.json({error:"Statut invalide."},{status:400});
  const supabase=await createClient();
  const patch={status:body.status,processed_by:profile.id,processed_at:["terminee","annulee"].includes(body.status||"")?new Date().toISOString():null};
  const {error}=await (supabase as any).from("acd_requests").update(patch).eq("id",requestId);
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true});
}
