import { NextResponse } from 'next/server';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadBelgiumProduction } from '@/lib/belgium/server';
import { validatedMentions } from '@/lib/quality-mentions';

const categories=['ecart_contrat','controle_a_refaire','autre'] as const;
export async function POST(request:Request){
 const profile=await requireProfile();
 if(!['admin','qualite'].includes(profile.role))return NextResponse.json({error:'Accès refusé.'},{status:403});
 const input=await request.json().catch(()=>null) as Record<string,unknown>|null;
 if(!input||typeof input!=='object')return NextResponse.json({error:'Données invalides.'},{status:400});
 const title=typeof input.title==='string'?input.title.trim():'';
 const description=typeof input.description==='string'?input.description.trim():'';
 const category=typeof input.category==='string'?input.category:'';
 const saleKey=typeof input.sale_key==='string'?input.sale_key.trim():'';
 let clientName=typeof input.client_name==='string'?input.client_name.trim():'';
 if(!title||title.length>180||!description||description.length>10000||!categories.includes(category as typeof categories[number])||saleKey.length>160||clientName.length>160)
  return NextResponse.json({error:'Renseignez un objet et une description valides.'},{status:400});
 let mentionedIds:string[];
 try{mentionedIds=await validatedMentions(input.mentioned_ids||[]);}catch(error){return NextResponse.json({error:(error as Error).message},{status:400});}
 if(saleKey){
  const production=await loadBelgiumProduction();
  const sale=production.contracts.find(c=>c.key===saleKey);
  if(!sale)return NextResponse.json({error:'Vente introuvable.'},{status:400});
  clientName=sale.client;
 }
 const db=await createClient();
 const {data,error}=await db.from('quality_incidents').insert({source:'crm',reporter_id:profile.id,reporter_name:profile.full_name,title,description,category:category as typeof categories[number],sale_key:saleKey||null,client_name:clientName||null,mentioned_ids:mentionedIds}).select('id').single();
 if(error||!data)return NextResponse.json({error:'Signalement non enregistré.'},{status:500});
 return NextResponse.json({id:data.id},{status:201});
}
