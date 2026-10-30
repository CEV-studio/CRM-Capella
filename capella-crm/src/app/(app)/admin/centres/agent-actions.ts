'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { centreNames } from '@/lib/belgium/centre-accounts';
import type { ActionResult } from '@/lib/action-result';

export async function saveSalesAgent(_previous:ActionResult|null,form:FormData):Promise<ActionResult>{
 await requireAdmin();
 const db=await createClient();
 const id=String(form.get('id')||'');
 const name=String(form.get('display_name')||'').trim();
 if(!name||name.length>120)return {ok:false,message:'Nom commercial requis (120 caractères maximum).'};
 if(id){
  if(!/^[0-9a-f-]{36}$/i.test(id))return {ok:false,message:'Agent invalide.'};
  const {data,error}=await db.from('be_sales_agents').update({display_name:name}).eq('id',id).select('id');
  if(error||!data?.length)return {ok:false,message:'Modification impossible.'};
 }else{
  const requested=String(form.get('centre')||'').trim();
  const centre=(await centreNames(db)).find(value=>value.toLocaleLowerCase('fr')===requested.toLocaleLowerCase('fr'));
  const ref=String(form.get('agent_ref')||'').trim().toLowerCase();
  if(!centre||!/^[a-z0-9._-]{2,80}$/.test(ref))return {ok:false,message:'Centre ou identifiant agent invalide.'};
  const {error}=await db.from('be_sales_agents').insert({centre,agent_ref:ref,display_name:name});
  if(error)return {ok:false,message:error.code==='23505'?'Cet agent existe déjà dans ce centre.':'Création impossible.'};
 }
 revalidatePath('/admin/centres');revalidatePath('/belgique');
 return {ok:true,message:id?'Nom enregistré.':'Agent ajouté au référentiel.'};
}

export async function toggleSalesAgent(_previous:ActionResult|null,form:FormData):Promise<ActionResult>{
 await requireAdmin();const id=String(form.get('id')||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))return {ok:false,message:'Agent invalide.'};
 const db=await createClient();
 const {data,error}=await db.from('be_sales_agents').update({is_active:form.get('active')==='true'}).eq('id',id).select('id');
 if(error||!data?.length)return {ok:false,message:'Modification impossible.'};
 revalidatePath('/admin/centres');revalidatePath('/belgique');
 return {ok:true,message:'Statut enregistré.'};
}
