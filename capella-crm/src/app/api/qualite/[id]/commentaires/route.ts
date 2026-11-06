import { NextRequest, NextResponse } from 'next/server';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { validatedTextMentions } from '@/lib/quality-mentions';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const profile=await requireProfile();
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Contrôle introuvable.'},{status:404});
 const db=await createClient();
 const {data:review,error:reviewError}=await db.from('quality_reviews').select('id').eq('id',id).maybeSingle();
 if(reviewError||!review)return NextResponse.json({error:'Contrôle introuvable ou inaccessible.'},{status:404});
 const input=await request.json().catch(()=>null);
 if(!input||typeof input!=='object')return NextResponse.json({error:'Commentaire invalide.'},{status:400});
 const body=typeof input.body==='string'?input.body.trim():'';
 if(!body||body.length>5000)return NextResponse.json({error:'Écrivez un commentaire de 1 à 5 000 caractères.'},{status:400});
 let mentionedIds:string[];
 try{mentionedIds=await validatedTextMentions(input.mentioned_ids??[],body);}catch(error){return NextResponse.json({error:(error as Error).message},{status:400});}
 const {data,error}=await db.from('quality_review_comments').insert({review_id:id,author_id:profile.id,author_name:profile.full_name,body,mentioned_ids:mentionedIds}).select('id').single();
 if(error||!data)return NextResponse.json({error:'Ajout du commentaire impossible.'},{status:500});
 return NextResponse.json({id:data.id},{status:201});
}
