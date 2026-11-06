import { NextResponse } from 'next/server';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { validatedMentions } from '@/lib/quality-mentions';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const profile=await requireProfile();
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Identifiant invalide.'},{status:400});
 const input=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const body=typeof input?.body==='string'?input.body.trim():'';
 if(!body||body.length>5000)return NextResponse.json({error:'Commentaire invalide.'},{status:400});
 let mentionedIds:string[];
 try{mentionedIds=await validatedMentions(input?.mentioned_ids||[]);}catch(error){return NextResponse.json({error:(error as Error).message},{status:400});}
 const db=await createClient();
 const {data,error}=await db.from('quality_incident_comments').insert({incident_id:id,author_id:profile.id,author_name:profile.full_name,body,mentioned_ids:mentionedIds}).select('id').single();
 if(error||!data)return NextResponse.json({error:'Commentaire non enregistré ou accès refusé.'},{status:403});
 return NextResponse.json({id:data.id},{status:201});
}
