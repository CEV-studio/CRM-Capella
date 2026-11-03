'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/action-result';

export async function enregistrerEquipe(_prev:ActionResult|null, form:FormData):Promise<ActionResult>{
 await requireAdmin();
 const id=String(form.get('id')??'');const name=String(form.get('name')??'').trim();const partner=String(form.get('partner_name')??'').trim();const manager=String(form.get('manager_id')??'');
 if(!name||name.length>120||partner.length>120||/[\u0000-\u001f]/.test(name+partner))return {ok:false,message:'Vérifie le nom de l’équipe et du partenaire.'};
 const db=createAdminClient();
 if(manager){const {data,error}=await db.from('profiles').select('id').eq('id',manager).eq('role','manager').eq('is_active',true).is('archived_at',null).maybeSingle();if(error||!data)return {ok:false,message:'Manager actif introuvable.'};}
 const values={name,partner_name:partner||null,manager_id:manager||null};
 const result=id?await db.from('partner_teams').update(values).eq('id',id).select('id').maybeSingle():await db.from('partner_teams').insert(values).select('id').single();
 if(result.error||!result.data)return {ok:false,message:result.error?.code==='23505'?'Une équipe porte déjà ce nom.':result.error?.message??'Équipe introuvable.'};
 revalidatePath('/admin/equipes');revalidatePath('/admin/commerciaux');revalidatePath('/equipe');return {ok:true,message:id?'Équipe mise à jour.':'Équipe créée.'};
}
