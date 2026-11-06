import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export async function validatedMentions(value: unknown): Promise<string[]> {
 if (!Array.isArray(value) || value.length > 20 || value.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
  throw new Error('Mentions invalides.');
 }
 const ids = [...new Set(value as string[])];
 if (!ids.length) return [];
 const {data,error} = await createAdminClient().from('profiles').select('id').in('id',ids).eq('is_active',true);
 if (error || data?.length !== ids.length) throw new Error('Un destinataire est introuvable.');
 return ids;
}

export async function validatedTextMentions(value:unknown,text:string):Promise<string[]>{
 const ids=await validatedMentions(value);
 if(!ids.length)return ids;
 const {data,error}=await createAdminClient().from('profiles').select('id,full_name').in('id',ids).eq('is_active',true);
 if(error||!data||data.some(person=>!text.includes(`@${person.full_name}`)))throw new Error('Sélectionnez les personnes mentionnées dans la synthèse.');
 return ids;
}
