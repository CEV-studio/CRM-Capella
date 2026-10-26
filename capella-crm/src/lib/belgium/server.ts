import 'server-only';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Contract,Statement,Invoice,ImportRun,CycleTracking,SupplierBilling,Deduction } from './domain';
export async function loadBelgium(){
 await requireAdmin();const db=await createClient();
 // Explicit paging avoids PostgREST's default 1,000-row truncation.
 async function all<T>(table:'be_contracts'|'be_statement_lines'|'be_invoices'|'be_imports'|'be_cycle_tracking'|'be_supplier_billing'|'be_deductions',order:string){const out:T[]=[];for(let offset=0;;offset+=1000){const {data,error}=await db.from(table).select('*').order(order).range(offset,offset+999);if(error)throw new Error(`Belgique : ${error.message}`);out.push(...data as T[]);if(data.length<1000)break;}return out;}
 const [raw,lines,invoices,imports,tracking,billing,deductions]=await Promise.all([all<{data:Contract}>('be_contracts','key'),all<{data:Statement}>('be_statement_lines','id'),all<Invoice>('be_invoices','created_at'),all<ImportRun>('be_imports','created_at'),all<CycleTracking>('be_cycle_tracking','contract_key'),all<SupplierBilling>('be_supplier_billing','period'),all<Deduction>('be_deductions','created_at')]);
 return {contracts:raw.map(r=>r.data),statements:lines.map(r=>r.data),invoices,imports:imports.reverse(),tracking,billing,deductions};
}

/** Load only the MEGA energy rows needed by the cross-activity admin dashboard. */
export async function loadBelgiumDashboardMetrics() {
 await requireAdmin();
 const db=await createClient();
 async function all<T>(table:'be_contracts'|'be_statement_lines',columns:'data'|'supplier,period,contract_key,gross_cents,centre_cents',order:'key'|'id'){
  const out:T[]=[];
  for(let offset=0;;offset+=1000){
   const {data,error}=await db.from(table).select(columns).order(order).range(offset,offset+999);
   if(error)throw new Error(`Belgique : ${error.message}`);
   out.push(...data as T[]);
   if(data.length<1000)break;
  }
  return out;
 }
 type ContractRow={data:Contract};
 type StatementRow={supplier:string;period:string;contract_key:string;gross_cents:number;centre_cents:number};
 const [contractRows,statementRows]=await Promise.all([
  all<ContractRow>('be_contracts','data','key'),
  all<StatementRow>('be_statement_lines','supplier,period,contract_key,gross_cents,centre_cents','id'),
 ]);
 return {
  contracts:contractRows.map(row=>row.data),
  statements:statementRows.map(row=>({key:row.contract_key,supplier:row.supplier,period:row.period,gross_cents:row.gross_cents,centre_cents:row.centre_cents,status:''} satisfies Statement)),
 };
}

/** Whitelisted production RPC: never loads financial JSON, invoices or statements. */
export async function loadBelgiumProduction(){
 const {requireProfile}=await import('@/lib/auth');
 const {redirect}=await import('next/navigation');
 const profile=await requireProfile();
 if(!['admin','qualite','be_centre','be_agent'].includes(profile.role))redirect('/?motif=acces-refuse');
 const db=await createClient();const {data,error}=await db.rpc('be_production_read',{});
 if(error)throw new Error(error.message);
 const result=data as unknown as {contracts:(Contract&{period_confirmed:boolean;phone?:string;postal_code?:string;product?:string;agent_reference?:string})[];tracking:CycleTracking[];last_report:string|null;encoding:{centre:string;agent_ref:string}|null;history:import('./clients').ProductionHistory[]};
 return {profile,...result,contracts:result.contracts.map(c=>({...c,gross_cents:0,centre_cents:0,payment:''}))};
}
