import 'server-only';
import type { Profile } from '@/lib/domain/database.types';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGmailAccountForProfile } from '@/lib/gmail-account';
import { sendGmailMessage } from '@/lib/gmail';
// Call only after authentication. Partners may dispatch only notifications generated
// by their own validated commands; admin may retry the queue. Recipients come from SQL.
export async function deliverNotifications(profile:Profile){
 if(!['admin','apporteur'].includes(profile.role))return {failed:0,sent:0};
 let failed=0,sent=0;
 try{
  const db=createAdminClient();
  let query=db.from('crm_notifications').select('*').in('email_status',['pending','failed']).order('created_at').limit(20);
  if(profile.role!=='admin')query=query.eq('actor_id',profile.id);
  const {data:rows,error}=await query;
  if(error)throw error;
  if(!rows?.length)return {failed,sent};
  const {data:sender}=await db.from('profiles').select('id').eq('role','admin').eq('is_active',true).eq('email','jeremy@capellaenergy.fr').maybeSingle();
  const account=sender?await getGmailAccountForProfile(sender.id,'send'):null;
  for(const row of rows){
   const {data:claimed}=await db.from('crm_notifications').update({email_status:'sending',email_attempt_at:new Date().toISOString()}).eq('id',row.id).in('email_status',['pending','failed']).select('id').maybeSingle();
   if(!claimed)continue;
   try{
    if(!account)throw new Error('Connectez la boîte Gmail de jeremy@capellaenergy.fr pour activer les alertes par mail.');
    await sendGmailMessage({to:row.email_to,subject:`Capella Energy — ${row.title}`,body:`${row.body}\n\nRetrouvez ce dossier dans votre CRM Capella Energy.`},account);
    const {error:updateError}=await db.from('crm_notifications').update({email_status:'sent',email_error:null}).eq('id',row.id);
    if(updateError)throw updateError;
    sent++;
   }catch(error){failed++;await db.from('crm_notifications').update({email_status:'failed',email_error:error instanceof Error?error.message:'Envoi impossible'}).eq('id',row.id);}
  }
 }catch{failed++;}
 return {failed,sent};
}
