'use server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
export async function createInvoice(form:FormData){await requireAdmin();const db=await createClient();const period=String(form.get('period')??'')+'-01';const {error}=await db.rpc('be_create_invoice',{p_centre:String(form.get('centre')),p_period:period,p_reference:String(form.get('reference'))});if(error)return {error:error.message};revalidatePath('/belgique');return {success:'Appel à facturation établi. Les lignes et le montant sont figés.'};}
export async function updateInvoice(form:FormData){await requireAdmin();const db=await createClient();const state=String(form.get('state'));if(!['Établie','Émise','Payée'].includes(state))return {error:'État invalide'};const issued=String(form.get('issued_at')??'')||null,paid=String(form.get('paid_at')??'')||null;const today=new Date().toISOString().slice(0,10);if((state==='Établie'&&(issued||paid))||(state==='Émise'&&paid))return {error:'Retirer les dates incompatibles avec cet état.'};if((issued&&issued>today)||(paid&&paid>today)||(paid&&issued&&paid<issued))return {error:'Dates incohérentes'};const {data,error}=await db.from('be_invoices').update({state,issued_at:issued,paid_at:paid}).eq('id',String(form.get('id'))).select('id');if(error||!data?.length)return {error:error?.message??'Pièce introuvable'};revalidatePath('/belgique');return {success:'État mis à jour à partir de ta confirmation.'};}

export async function saveCycle(form:FormData){
 await requireAdmin();const db=await createClient();
 const {contractCycle}=await import('@/lib/belgium/finance');
 const {loadBelgium}=await import('@/lib/belgium/server');
 const {contracts,statements}=await loadBelgium();
 const key=String(form.get('contract_key')??''),contract=contracts.find(c=>c.key===key);
 if(!contract)return {error:'Contrat introuvable'};
 const today=new Date().toISOString().slice(0,10);
 const date=(name:string)=>String(form.get(name)??'')||null;
 const amount=(name:string)=>{const value=Number(String(form.get(name)??'0').replace(',','.'));if(!Number.isFinite(value)||value<0)throw new Error('Montant invalide');return Math.round(value*100);};
 try{
 const row={contract_key:key,effect_date:date('effect_date'),termination_date:date('termination_date'),completed_at:date('completed_at'),bonus_invoiced_at:date('bonus_invoiced_at'),bonus_paid_at:date('bonus_paid_at'),centre_recovered_cents:amount('centre_recovered'),mega_recovered_cents:amount('mega_recovered'),notes:String(form.get('notes')??''),updated_at:new Date().toISOString()};
 for(const d of [row.effect_date,row.termination_date,row.completed_at,row.bonus_invoiced_at,row.bonus_paid_at])if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>today))return {error:'Dates confirmées invalides ou futures'};
 if(row.termination_date&&row.effect_date&&row.termination_date<row.effect_date)return {error:'La résiliation précède la prise d’effet'};
 const cycle=contractCycle(contract,statements,row,today);
 if((row.bonus_invoiced_at||row.bonus_paid_at)&&cycle.bonusState==='none'||(row.bonus_invoiced_at||row.bonus_paid_at)&&cycle.bonusState==='potential')return {error:'Le cycle de trois mois doit être confirmé avant de facturer le bonus'};
 if(row.centre_recovered_cents>(cycle.centreDue??0)||row.mega_recovered_cents>(cycle.megaDue??0))return {error:'La récupération dépasse la reprise calculée ou les dates de reprise ne sont pas confirmées'};
 const {error}=await db.from('be_cycle_tracking').upsert(row);if(error)return {error:error.message};
 revalidatePath('/belgique');return {success:'Dates confirmées et suivi financier enregistrés.'};
 }catch(e){return {error:e instanceof Error?e.message:'Enregistrement impossible'};}
}
export async function saveSupplierBilling(form:FormData){
 await requireAdmin();const db=await createClient();
 const period=String(form.get('period')??'')+'-01',invoiced=form.get('invoiced')==='on';
 const received=Number(String(form.get('received')??'0').replace(',','.'));
 if(!/^\d{4}-\d{2}-01$/.test(period)||!Number.isFinite(received)||received<0)return {error:'Période ou montant invalide'};
 const lines:Array<{gross_cents:number}>=[];
 for(let offset=0;;offset+=1000){const result=await db.from('be_statement_lines').select('gross_cents').eq('supplier','MEGA').eq('period',period).order('id').range(offset,offset+999);if(result.error)return {error:result.error.message};lines.push(...result.data);if(result.data.length<1000)break;}
 const total=(lines??[]).reduce((sum,l)=>sum+l.gross_cents,0);
 if((invoiced||received>0)&&!lines?.length)return {error:'Importer l’appel officiel avant de confirmer une facture'};
 if(Math.round(received*100)>total)return {error:'Le montant reçu dépasse le montant de l’appel officiel. Traiter les régularisations séparément.'};
 const date=(name:string)=>String(form.get(name)??'')||null;
 const row={supplier:'MEGA',period,call_received_at:date('call_received_at'),invoiced,invoiced_at:date('invoiced_at'),invoice_reference:String(form.get('invoice_reference')??'')||null,received_cents:Math.round(received*100),received_at:date('received_at'),notes:String(form.get('notes')??''),updated_at:new Date().toISOString()};
 const today=new Date().toISOString().slice(0,10);
 if([row.call_received_at,row.invoiced_at,row.received_at].some(d=>d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>today)))return {error:'Dates invalides ou futures'};
 if(!invoiced&&(row.invoiced_at||row.received_at||row.received_cents>0))return {error:'Confirmer la facturation avant de saisir un encaissement'};
 const {error}=await db.from('be_supplier_billing').upsert(row);if(error)return {error:error.message};
 revalidatePath('/belgique');return {success:'Suivi de la facture MEGA enregistré. Aucune facture n’a été envoyée.'};
}
