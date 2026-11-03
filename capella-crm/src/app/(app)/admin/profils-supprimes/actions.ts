'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/action-result';

export async function modifierCorbeilleProfil(_prev:ActionResult|null, form:FormData):Promise<ActionResult> {
 const actor=await requireAdmin();
 const id=String(form.get('id')||''); const operation=String(form.get('operation')||'');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||id===actor.id||!['supprimer','restaurer'].includes(operation)) return {ok:false,message:'Action interdite.'};
 const db=createAdminClient();
 const patch=operation==='supprimer'?{archived_at:new Date().toISOString(),is_active:false}:{archived_at:null,is_active:false};
 let query=db.from('profiles').update(patch).eq('id',id).neq('role','admin');
 query=operation==='supprimer'?query.is('archived_at',null):query.not('archived_at','is',null);
 const {data,error}=await query.select('id').maybeSingle();
 if(error||!data)return {ok:false,message:error?.message??'Compte introuvable ou non autorisé.'};
 revalidatePath('/admin/commerciaux');revalidatePath('/admin/centres');revalidatePath('/admin/profils-supprimes');revalidatePath('/equipe');
 return {ok:true,message:operation==='supprimer'?'Profil placé dans la corbeille et compte désactivé.':'Profil restauré. Le compte reste désactivé jusqu’à sa réactivation.'};
}
