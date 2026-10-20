import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadBelgium } from '@/lib/belgium/server';
import { parseRows, norm, type Contract } from '@/lib/belgium/domain';
import { parseCsv } from '@/lib/csv';
export const runtime='nodejs';
export async function POST(request:Request){
 await requireAdmin();
 try{
 const form=await request.formData();const file=form.get('file');
 if(!(file instanceof File)||file.size===0||file.size>10*1024*1024)throw new Error('Choisir un fichier CSV ou XLSX de moins de 10 Mo.');
 const kind=form.get('kind')==='statement'?'statement':'report';const date=String(form.get('date')??'');const period=String(form.get('period')??'')+'-01';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>new Date().toISOString().slice(0,10))throw new Error('Date du reporting invalide ou future.');
 let rows:unknown[][];const bytes=await file.arrayBuffer();
 if(file.name.toLowerCase().endsWith('.xlsx')){
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes);const hasHeaders=(s:ExcelJS.Worksheet)=>Array.from({length:Math.min(20,s.rowCount)},(_,i)=>s.getRow(i+1)).some(row=>{const v=row.values;return Array.isArray(v)&&v.some(x=>norm(x)==='ean')&&v.some(x=>['id','idmega'].includes(norm(x)));});
 const preferred=kind==='report'?workbook.worksheets.find(s=>norm(s.name)==='registredefacturation'):workbook.worksheets.find(s=>norm(s.name).startsWith('appelmega'));
 const sheet=preferred&&hasHeaders(preferred)?preferred:workbook.worksheets.find(hasHeaders);if(!sheet)throw new Error('Aucun onglet avec les colonnes ID et EAN.');
 if(sheet.rowCount>10020||sheet.columnCount>100)throw new Error('Classeur trop volumineux.');rows=[];
 sheet.eachRow(row=>{rows.push(Array.from({length:sheet.columnCount},(_,i)=>{const c=row.getCell(i+1).value;if(c&&typeof c==='object'&&!(c instanceof Date)){if('result' in c)return c.result;if('richText' in c)return c.richText.map(t=>t.text).join('');if('text' in c)return c.text;}return c;}));});
 }else if(/\.(csv|tsv)$/i.test(file.name)){rows=parseCsv(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}else throw new Error('Format accepté : CSV, TSV ou XLSX.');
 const parsed=parseRows(rows,kind,date,period);if(parsed.length===0||parsed.length>10000)throw new Error('Le fichier doit contenir de 1 à 10 000 contrats.');
 const fingerprint=createHash('sha256').update(kind+date+(kind==='statement'?period:'')).update(Buffer.from(bytes)).digest('hex');
 if(form.get('confirm')!=='yes'){
 const existing=await loadBelgium();const byKey=new Map(existing.contracts.map(c=>[c.key,c]));
 const lookup=(row:Contract)=>byKey.get(row.key)??existing.contracts.find(c=>c.mega_id===row.mega_id&&norm(c.energy)===norm(row.energy)&&(!c.ean||c.ean===row.ean));
 const changes=parsed.map(row=>{
 const next=row as Contract;const old=lookup(next);
 const merged=old?{...next,key:old.key,effect_date:old.effect_date??next.effect_date,period:old.period??next.period,clawback_end:old.clawback_end??next.clawback_end}:next;
 const stable=(value:Contract)=>JSON.stringify(Object.fromEntries(Object.entries(value).filter(([k])=>k!=='report_date').sort(([a],[b])=>a.localeCompare(b))));
 const attribution=!!old&&(old.agent!==next.agent||old.centre!==next.centre);
 const changeKind=kind==='statement'?'Montant validé':!old?'Ajout':old.status!==next.status?'Statut modifié':attribution?'Attribution modifiée':stable(old)!==stable(merged)?'Informations modifiées':'Inchangé';
 return {key:row.key,client:next.client??old?.client,centre:next.centre??old?.centre,before:attribution?`${old.status} · ${old.agent} · ${old.centre}`:old?.status??'Absent du CRM',after:attribution?`${next.status} · ${next.agent} · ${next.centre}`:next.status,kind:changeKind};
 });
 const older=kind==='report'?parsed.filter(r=>{const old=lookup(r as Contract);return old&&old.report_date>date;}):[];
 return NextResponse.json({count:parsed.length,added:changes.filter(c=>c.kind==='Ajout').length,statusChanges:changes.filter(c=>c.kind==='Statut modifié').length,changes,blocked:older.length>0||existing.imports.some(i=>i.fingerprint===fingerprint),warning:existing.imports.some(i=>i.fingerprint===fingerprint)?'Ce fichier a déjà été importé.':older.length?'Un reporting plus récent existe pour ces contrats. Import refusé.':'Les dates d’effet absentes sont estimées à la date du reporting lors du premier statut effectif. Aucun paiement n’est déduit de l’import.'});
 }
 const db=await createClient();const {data,error}=await db.rpc('be_import',{p_kind:kind,p_source:file.name,p_date:date,p_fingerprint:fingerprint,p_rows:parsed});if(error)throw new Error(error.message);
 return NextResponse.json({result:data});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Import impossible'},{status:400});}
}
