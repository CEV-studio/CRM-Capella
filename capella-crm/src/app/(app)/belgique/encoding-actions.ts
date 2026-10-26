'use server';
import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/action-result';

export async function encoderVente(_prev:ActionResult|null,form:FormData):Promise<ActionResult>{
 const profile=await requireProfile();
 if(profile.role!=='be_agent'||profile.must_change_password)return {ok:false,message:'Accès encodage refusé.'};
 const fields=['mega_id','first_name','last_name','phone','email','energy','ean','contract_reference','product','comment'] as const;
 const payload=Object.fromEntries(fields.map(k=>[k,String(form.get(k)||'').trim()]));
 if(!/^\d{1,20}$/.test(payload.mega_id)||!['Elec','Gaz'].includes(payload.energy))return {ok:false,message:'ID MEGA et énergie requis.'};
 if(!payload.first_name||!payload.last_name||payload.first_name.length>100||payload.last_name.length>100)return {ok:false,message:'Nom et prénom requis (100 caractères maximum).'};
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)||payload.email.length>254||payload.phone.length<6||payload.phone.length>40)return {ok:false,message:'Téléphone et email valides requis.'};
 if(payload.ean&&!/^\d{18}$/.test(payload.ean))return {ok:false,message:'L’EAN doit contenir 18 chiffres.'};
 if(payload.comment.length>5000||payload.product.length>200||payload.contract_reference.length>100)return {ok:false,message:'Un champ dépasse la longueur autorisée.'};
 const db=await createClient();const {error}=await db.rpc('be_encode_sale',{p_data:payload});
 if(error)return {ok:false,message:error.code==='23505'?'Cette vente a déjà été encodée.':error.message};
 revalidatePath('/belgique');return {ok:true,message:'Vente enregistrée au statut Signé.',venteMegaId:payload.mega_id};
}

export async function sauvegarderCommentaire(_prev:ActionResult|null,form:FormData):Promise<ActionResult>{
 const profile=await requireProfile();
 if(!['admin','qualite','be_centre','be_agent'].includes(profile.role)||profile.must_change_password)return {ok:false,message:'Accès refusé.'};
 const body=String(form.get('body')||'').trim(),mega=String(form.get('mega_id')||''),centre=String(form.get('centre')||''),id=String(form.get('id')||'')||null;
 if(!body||body.length>5000||!/^\d{1,20}$/.test(mega)||!centre||id&&!/^[0-9a-f-]{36}$/i.test(id))return {ok:false,message:'Commentaire invalide (5 000 caractères maximum).'};
 const db=await createClient();const {error}=await db.rpc('be_save_comment',{p_id:id,p_mega:mega,p_centre:centre,p_body:body});
 if(error)return {ok:false,message:'Enregistrement du commentaire refusé.'};
 revalidatePath('/belgique');return {ok:true,message:'Commentaire enregistré.'};
}
