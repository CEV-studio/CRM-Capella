import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/domain/database.types';

export async function centreNames(db:SupabaseClient<Database>){
 const names=new Set<string>();
 for(const table of ['be_contracts','be_access'] as const){
  for(let offset=0;;offset+=1000){
   const {data,error}=await db.from(table).select('centre').order('centre').range(offset,offset+999);
   if(error)throw new Error('Lecture des centres impossible.');
   for(const row of data||[])names.add(row.centre);
   if((data||[]).length<1000)break;
  }
 }
 return [...names].sort((a,b)=>a.localeCompare(b,'fr'));
}

// The Auth user stays banned until both its restricted profile and centre scope exist.
export async function provisionCentre(db:SupabaseClient<Database>,input:{name:string;email:string;centre:string;password:string}){
 const {data,error}=await db.auth.admin.createUser({email:input.email,password:input.password,email_confirm:true,ban_duration:'876000h',user_metadata:{full_name:input.name,commission_rate:0,must_change_password:true}});
 if(error||!data.user)throw new Error(error?.message||'Création impossible.');
 const id=data.user.id;
 try{
  const profile=await db.from('profiles').update({role:'be_centre',commission_rate:0,is_active:false,must_change_password:true,can_export:false,can_view_all:false,can_manage_team:false}).eq('id',id).select('id').single();
  if(profile.error||!profile.data)throw new Error('Configuration du profil impossible.');
  const scope=await db.from('be_access').insert({user_id:id,centre:input.centre,agent_ref:null,is_active:true});
  if(scope.error)throw new Error('Affectation au centre impossible.');
  const active=await db.from('profiles').update({is_active:true}).eq('id',id).eq('role','be_centre').select('id').single();
  if(active.error||!active.data)throw new Error('Activation du profil impossible.');
  const unban=await db.auth.admin.updateUserById(id,{ban_duration:'none'});
  if(unban.error)throw new Error('Activation du compte impossible.');
  return id;
 }catch{
  // Do not return credentials for a partially configured account.
  await db.from('profiles').update({is_active:false}).eq('id',id);
  await db.auth.admin.deleteUser(id);
  throw new Error('Création annulée : le compte n’a pas pu être configuré.');
 }
}
