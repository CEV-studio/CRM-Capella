import {NextResponse} from 'next/server';
import {revalidatePath} from 'next/cache';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
export async function POST(request:Request){await requireProfile();const body=await request.json().catch(()=>({}));const db=await createClient();const {error}=await db.rpc('partner_command',{p_action:'read',p_id:body.id});if(error)return NextResponse.json({error:error.message},{status:400});revalidatePath('/notifications');return NextResponse.json({ok:true});}
