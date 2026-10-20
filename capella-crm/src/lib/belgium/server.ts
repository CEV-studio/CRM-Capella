import 'server-only';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Contract,Statement,Invoice,ImportRun } from './domain';
export async function loadBelgium(){
 await requireAdmin();const db=await createClient();
 // Explicit paging avoids PostgREST's default 1,000-row truncation.
 async function all<T>(table:'be_contracts'|'be_statement_lines'|'be_invoices'|'be_imports',order:string){const out:T[]=[];for(let offset=0;;offset+=1000){const {data,error}=await db.from(table).select('*').order(order).range(offset,offset+999);if(error)throw new Error(`Belgique : ${error.message}`);out.push(...data as T[]);if(data.length<1000)break;}return out;}
 const [raw,lines,invoices,imports]=await Promise.all([all<{data:Contract}>('be_contracts','key'),all<{data:Statement}>('be_statement_lines','id'),all<Invoice>('be_invoices','created_at'),all<ImportRun>('be_imports','created_at')]);
 return {contracts:raw.map(r=>r.data),statements:lines.map(r=>r.data),invoices,imports:imports.reverse()};
}
