import {NextResponse} from 'next/server';
import {requireAdmin,requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {deliverNotifications} from '@/lib/partners/notifications';
export async function GET(){
 const profile=await requireProfile();const db=await createClient();
 const {count,error}=await db.from('crm_notifications').select('id',{count:'exact',head:true}).eq('recipient_id',profile.id).is('read_at',null);
 return NextResponse.json({count:count??0,error:error?'Notifications indisponibles':null});
}
export async function POST(){const p=await requireAdmin();return NextResponse.json(await deliverNotifications(p));}
