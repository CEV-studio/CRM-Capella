import { hasAnyPermission } from '@/lib/permissions';
import 'server-only';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
export async function partnerContext(){
 const profile=await requireProfile();
 if(!hasAnyPermission(profile,['administration','adv','apporteur'])) notFound();
 const supabase=await createClient();
 return {profile,db:supabase};
}
