import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGmailAccountForProfile } from '@/lib/gmail-account';
import { gmailRequest,parseGmailMessage } from '@/lib/gmail';

type Listed={messages?:Array<{id:string}>};
type FullMessage=Parameters<typeof parseGmailMessage>[0];
const reportSubject=/rapport|anomal|qualit|contr[oô]le|incident|alerte/i;

export async function POST(){
 const profile=await requireAdmin();
 const account=await getGmailAccountForProfile(profile.id,'read');
 if(!account)return NextResponse.json({connected:false,imported:0});
 const admin=createAdminClient();
 const {data:reporters,error:reportersError}=await admin.from('profiles').select('email,full_name').eq('role','qualite').eq('is_active',true);
 if(reportersError)return NextResponse.json({error:'Responsables qualité indisponibles.'},{status:500});
 const byEmail=new Map((reporters||[]).map(r=>[r.email.toLowerCase(),r.full_name]));
 if(!byEmail.size)return NextResponse.json({connected:true,imported:0});
 try{
  const batches=await Promise.all([...byEmail.keys()].map(async sender=>{
   const q=`from:${sender} newer_than:30d {subject:rapport subject:anomalie subject:qualité subject:controle subject:contrôle subject:incident subject:alerte}`;
   const found=await gmailRequest<Listed>(account,`/messages?maxResults=50&q=${encodeURIComponent(q)}`);
   return (found.messages||[]).map(m=>m.id);
  }));
  const ids=[...new Set(batches.flat())];
  if(!ids.length)return NextResponse.json({connected:true,imported:0});
  const {data:existing,error:existingError}=await admin.from('quality_incidents').select('source_message_id').eq('source_account_id',account.id).in('source_message_id',ids);
  if(existingError)throw new Error(existingError.message);
  const known=new Set((existing||[]).map(r=>r.source_message_id));
  const candidates=ids.filter(id=>!known.has(id)).slice(0,20);
  const messages=await Promise.all(candidates.map(async id=>{
   const raw=await gmailRequest<FullMessage>(account,`/messages/${encodeURIComponent(id)}?format=full`);
   return parseGmailMessage(raw,account.email);
  }));
  const rows=messages.filter(m=>m.direction==='incoming'&&byEmail.has(m.from_email||'')&&reportSubject.test(m.subject||'')).map(m=>({
   source:'email' as const,source_account_id:account.id,source_message_id:m.gmail_message_id,source_thread_id:m.gmail_thread_id,
   reporter_id:null,reporter_name:byEmail.get(m.from_email||'')!,title:(m.subject||'Rapport qualité').slice(0,180),
   description:(m.body_text||m.snippet||'Rapport reçu par email').slice(0,10000),category:'autre' as const,
   attachment_names:m.attachments.map(a=>a.filename).slice(0,30),reported_at:m.sent_at,
  }));
  if(!rows.length)return NextResponse.json({connected:true,imported:0});
  const {data:inserted,error}=await admin.from('quality_incidents').upsert(rows,{onConflict:'source_account_id,source_message_id',ignoreDuplicates:true}).select('id');
  if(error)throw new Error(error.message);
  return NextResponse.json({connected:true,imported:inserted?.length||0});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Synchronisation impossible.'},{status:502});}
}
