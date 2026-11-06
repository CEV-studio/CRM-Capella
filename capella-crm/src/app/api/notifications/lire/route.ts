import {NextResponse} from 'next/server';
import {revalidatePath} from 'next/cache';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
export async function POST(request:Request){const profile=await requireProfile();const body=await request.json().catch(()=>({}));if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id))return NextResponse.json({error:'Identifiant invalide.'},{status:400});const db=await createClient();const {data,error}=await db.from('crm_notifications').update({read_at:new Date().toISOString()}).eq('id',body.id).eq('recipient_id',profile.id).select('id').maybeSingle();if(error||!data)return NextResponse.json({error:'Notification introuvable.'},{status:404});revalidatePath('/notifications');return NextResponse.json({ok:true});}
