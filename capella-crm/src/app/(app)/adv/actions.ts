"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";

export async function enregistrerAdv(_prev:ActionResult|null,formData:FormData):Promise<ActionResult>{
 const profil=await requireProfile();if(profil.role!=="admin")return{ok:false,message:"Accès ADV réservé à l’administrateur."};
 const id=String(formData.get("id")??"");const stage=String(formData.get("stage")??"");const brut=String(formData.get("commission")??"").replace(",",".").trim();const commission=brut===""?0:Number(brut);if(!id)return{ok:false,message:"Dossier introuvable."};if(!Number.isFinite(commission)||commission<0)return{ok:false,message:"Commission invalide."};
 const patch:Record<string,unknown>={stage,commission};if(stage==="Signé")patch.date_signature=String(formData.get("date_signature")??"").trim()||new Date().toISOString().slice(0,10);
 const supabase=await createClient();const {error}=await supabase.from("affaires").update(patch).eq("id",id);if(error)return{ok:false,message:error.message};revalidatePath("/adv");revalidatePath("/conversion");revalidatePath(`/conversion/${id}`);revalidatePath("/commissions");return{ok:true,message:"ADV enregistré."};
}
