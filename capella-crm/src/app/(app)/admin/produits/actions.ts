'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/action-result';
export async function creerProduit(_prev:ActionResult|null,form:FormData):Promise<ActionResult>{
 await requireAdmin();
 const label=String(form.get('label')||'').trim(),kind=String(form.get('kind')||'other'),supplier=String(form.get('supplier')||'').trim();
 if(!label||label.length>120||supplier.length>80||!['energy','telecom','other'].includes(kind))return {ok:false,message:'Nom, type ou fournisseur invalide.'};
 const db=await createClient();const {error}=await db.from('be_products').insert({label,kind:kind as 'energy'|'telecom'|'other',supplier,is_active:true});
 if(error)return {ok:false,message:error.code==='23505'?'Ce produit existe déjà.':'Création du produit impossible.'};
 revalidatePath('/admin/produits');revalidatePath('/belgique/encoder');return {ok:true,message:'Produit ajouté au menu d’encodage.'};
}
export async function activerProduit(_prev:ActionResult|null,form:FormData):Promise<ActionResult>{
 await requireAdmin();const id=String(form.get('id')||''),active=form.get('active')==='true';
 if(!/^[0-9a-f-]{36}$/i.test(id))return {ok:false,message:'Produit invalide.'};
 const db=await createClient();const {error}=await db.from('be_products').update({is_active:active}).eq('id',id);
 if(error)return {ok:false,message:'Modification impossible.'};
 revalidatePath('/admin/produits');revalidatePath('/belgique/encoder');return {ok:true,message:active?'Produit activé.':'Produit désactivé.'};
}
