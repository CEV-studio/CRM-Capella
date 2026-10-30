'use server';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { centreNames,provisionCentre } from '@/lib/belgium/centre-accounts';
import type { ActionResult } from '@/lib/action-result';

const password=()=>`Capella-${randomBytes(12).toString('base64url')}`;
export async function creerCentre(_prev:ActionResult|null,form:FormData):Promise<ActionResult>{
 await requireAdmin();
 const name=String(form.get('full_name')||'').trim(),email=String(form.get('email')||'').trim().toLowerCase(),requested=String(form.get('centre')||'').trim().replace(/\s+/g,' ');
 if(!name||name.length>120)return {ok:false,message:'Indique un nom de compte (120 caractères maximum).'};
 if(email.length>254||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return {ok:false,message:'Adresse email invalide.'};
 if(!requested||requested.length>100||/[\u0000-\u001f]/.test(requested))return {ok:false,message:'Indique un centre (100 caractères maximum).'};
 try{
  const db=createAdminClient(),names=await centreNames(db);
  const centre=names.find(n=>n.toLocaleLowerCase('fr')===requested.toLocaleLowerCase('fr'))||requested;
  const kind=String(form.get('kind')||'centre');
  if(!['centre','agent'].includes(kind))return {ok:false,message:'Type de compte invalide.'};
  const agentRef=kind==='agent'?String(form.get('agent_ref')||'').trim().toLowerCase():undefined;
  if(kind==='agent'&&(!agentRef||!/^[a-z0-9._-]{2,80}$/.test(agentRef)||agentRef==='non'))return {ok:false,message:'Identifiant agent MEGA requis (lettres, chiffres, point, tiret).'};
  if(kind==='agent'&&!names.includes(centre))return {ok:false,message:'Sélectionne un centre existant.'};
  if(agentRef==='houssamterazi'&&centre!=='Cimsourse')return {ok:false,message:'Houssam Terazi est rattaché à Cimsourse.'};
  if(agentRef){
   const {error:rosterError}=await db.from('be_sales_agents').upsert({centre,agent_ref:agentRef,display_name:name},{onConflict:'centre,agent_ref',ignoreDuplicates:true});
   if(rosterError)return {ok:false,message:'Référencement de l’agent impossible.'};
  }
  const motDePasse=password();await provisionCentre(db,{name,email,centre,password:motDePasse,agentRef});
  revalidatePath('/admin/centres');
  return {ok:true,message:`Compte créé : ${email} · ${centre}`,motDePasse};
 }catch(error){return {ok:false,message:error instanceof Error&&/already|registered|exists/i.test(error.message)?'Un compte utilise déjà cette adresse email.':error instanceof Error?error.message:'Création impossible.'};}
}

export async function gererCentre(_prev:ActionResult|null,form:FormData):Promise<ActionResult>{
 await requireAdmin();
 const id=String(form.get('id')||''),operation=form.get('operation');
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['activer','desactiver','password'].includes(String(operation)))return {ok:false,message:'Action invalide.'};
 const db=createAdminClient();
 const {data:profile,error}=await db.from('profiles').select('id,is_active').eq('id',id).in('role',['be_centre','be_agent']).single();
 if(error||!profile)return {ok:false,message:'Compte centre ou agent introuvable.'};
 if(operation==='password'){
  const motDePasse=password();
  const flag=await db.from('profiles').update({must_change_password:true}).eq('id',id).in('role',['be_centre','be_agent']);
  if(flag.error)return {ok:false,message:'Réinitialisation impossible.'};
  const reset=await db.auth.admin.updateUserById(id,{password:motDePasse});
  if(reset.error)return {ok:false,message:'Réinitialisation impossible.'};
  revalidatePath('/admin/centres');return {ok:true,message:'Nouveau mot de passe provisoire.',motDePasse};
 }
 const update=await db.from('profiles').update({is_active:operation==='activer'}).eq('id',id).in('role',['be_centre','be_agent']);
 if(update.error)return {ok:false,message:'Modification impossible.'};
 revalidatePath('/admin/centres');return {ok:true,message:operation==='activer'?'Compte activé.':'Compte désactivé.'};
}
