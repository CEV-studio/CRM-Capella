import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { partnerContext } from '@/lib/partners/server';
import { deliverNotifications } from '@/lib/partners/notifications';
export async function POST(request:Request){
 const {profile,db}=await partnerContext();
 const body=await request.json().catch(()=>null);
 if(!body || !['draft','submit','resend','quote','message','documents','read'].includes(body.action) || !/^[0-9a-f-]{36}$/i.test(body.id??'')) return NextResponse.json({error:'Demande invalide'},{status:400});
 const {data,error}=await db.rpc('partner_command',{p_action:body.action,p_id:body.id,p_data:body.data??{}});
 if(error)return NextResponse.json({error:error.message},{status:400});
 const email=body.action==='read'||body.action==='draft'?null:await deliverNotifications(profile);
 revalidatePath('/partenaires','layout');revalidatePath('/admin/acd');revalidatePath('/adv');revalidatePath('/notifications');
 return NextResponse.json({id:data,email});
}
