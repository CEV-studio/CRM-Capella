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
