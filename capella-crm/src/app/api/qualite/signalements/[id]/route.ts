import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 await requireAdmin();
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Identifiant invalide.'},{status:400});
 const input=await request.json().catch(()=>null) as {status?:string}|null;
 if(!input||!['ouvert','en_cours','resolu'].includes(input.status||''))return NextResponse.json({error:'Statut invalide.'},{status:400});
 const db=await createClient();
 const {data,error}=await db.from('quality_incidents').update({status:input.status as 'ouvert'|'en_cours'|'resolu',resolved_at:input.status==='resolu'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',id).select('id').maybeSingle();
 if(error||!data)return NextResponse.json({error:'Mise à jour impossible.'},{status:400});
 return NextResponse.json({ok:true});
}
