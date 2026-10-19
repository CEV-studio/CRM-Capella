import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
process.on('unhandledRejection',e=>{console.error('TEST FAILED:',e.message,e.where??'');process.exit(1);});
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema public,auth,storage to authenticated,anon,service_role;grant execute on all functions in schema auth to authenticated;
alter default privileges in schema public grant all on tables to authenticated,service_role;
`);
for(const file of fs.readdirSync(root+'/supabase/migrations').sort()){
 let sql=fs.readFileSync(root+'/supabase/migrations/'+file,'utf8').replace(/create extension if not exists "pgcrypto";/g,'');
 try{await db.exec(sql);console.log('OK',file);}catch(e){console.error('FAIL',file,e.message);process.exit(1);}
}
await db.exec('grant all on all sequences in schema public to authenticated,service_role;');

const admin='10000000-0000-4000-8000-000000000001',a='10000000-0000-4000-8000-000000000002',b='10000000-0000-4000-8000-000000000003',commercial='10000000-0000-4000-8000-000000000004';
await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values
('${admin}','jeremy@capellaenergy.fr','{"full_name":"Admin"}'),('${a}','a@example.org','{"full_name":"Partner A"}'),('${b}','b@example.org','{"full_name":"Partner B"}'),('${commercial}','commercial@example.org','{"full_name":"Commercial"}');
update public.profiles set role='admin' where id='${admin}';update public.profiles set role='apporteur' where id in ('${a}','${b}');`);
async function asUser(id){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`);}
async function cmd(action,id,data={}){const r=await db.query('select public.partner_command($1,$2,$3::jsonb) as id',[action,id,JSON.stringify(data)]);return r.rows[0].id;}
async function rejects(fn,text){await assert.rejects(fn);console.log('PASS deny:',text);}
const did='20000000-0000-4000-8000-000000000001';
const payload={siret:'12345678900011',raison_sociale:'Société test',company_address:'1 rue Test',company_postal_code:'75002',company_city:'Paris',signatory_first_name:'Test',signatory_last_name:'Client',signatory_email:'client@example.org',signatory_phone:'0612345678',signatory_role:'Gérant',signatory_capacity:'representant_legal',meters:[{energy_type:'electricite',identifier:'12345678901234',contract_expiry:'2027-12-31',address:'1 rue Test',postal_code:'75002',city:'Paris'},{energy_type:'gaz',identifier:'12345678901235',contract_expiry:'2027-12-31',address:'1 rue Test',postal_code:'75002',city:'Paris'}]};
await asUser(a);await cmd('draft',did,payload);await cmd('draft',did,payload);
let dossiers=(await db.query('select * from public.partner_dossiers')).rows;assert.equal(dossiers.length,1);const pid=dossiers[0].prospect_id;
await rejects(()=>cmd('submit',did,payload),'submission without invoice');
await rejects(()=>cmd('quote',did,{}),'quote before signed ACD');
await db.query(`insert into public.pieces_jointes(type,prospect_id,bucket_path,file_name) values('Facture',$1,$2,'facture.pdf')`,[pid,`prospects/${pid}/facture.pdf`]);
await cmd('submit',did,payload);await cmd('submit',did,payload);
assert.equal((await db.query('select count(*)::int n from public.acd_requests')).rows[0].n,1);
assert.equal((await db.query('select acd_status from public.partner_dossiers')).rows[0].acd_status,'envoyee');
await cmd('resend',did);await rejects(()=>cmd('resend',did),'repeated resend is rate limited');
await rejects(()=>db.query(`update public.partner_dossiers set acd_status='signee' where id=$1`,[did]),'partner cannot sign ACD');
await rejects(()=>db.query(`select private.partner_notify($1,'Fake','Fake',true)`,[did]),'partner cannot generate arbitrary notifications');
await asUser(b);assert.equal((await db.query('select * from public.partner_dossiers')).rows.length,0);
assert.equal((await db.query('select * from public.prospects')).rows.length,0);
assert.equal((await db.query('select * from public.pieces_jointes')).rows.length,0);
await rejects(()=>cmd('submit',did,payload),'other partner cannot act on dossier');
await rejects(()=>cmd('draft',did,payload),'idempotency key cannot hijack another dossier');
await asUser(admin);assert.equal((await db.query('select * from public.partner_dossiers')).rows.length,1);
await db.query(`update public.acd_requests set status='terminee' where prospect_id=$1`,[pid]);
assert.equal((await db.query('select * from public.affaires')).rows.length,0,'ACD signature must not create an affaire');
await asUser(a);assert.equal((await db.query('select acd_status from public.partner_dossiers')).rows[0].acd_status,'signee');
assert.ok((await db.query("select * from public.crm_notifications where title='ACD signée'")).rows.length);
const quote={request_key:'30000000-0000-4000-8000-000000000001',start_date:'2028-01-01',end_date:'2028-12-31',quote_date:'2027-10-01',comment:'Demande test',meters:payload.meters,is_regie:true,offer_market:true,offer_other:false};
await rejects(()=>cmd('quote',did,{...quote,end_date:'2027-01-01'}),'inverted contract dates');
const qid=await cmd('quote',did,quote);assert.equal(await cmd('quote',did,quote),qid);
assert.equal((await db.query('select * from public.partner_quotes')).rows.length,1);
assert.equal((await db.query('select * from public.affaires')).rows.length,0,'global margins hidden from partner');
await rejects(()=>db.query(`insert into public.affaire_adv_checks(affaire_id,verification_calls) values((select affaire_id from public.partner_quotes limit 1),true)`),'ADV checkbox inaccessible');
await cmd('message',did,{kind:'contrat',quote_id:qid,body:'Merci d’envoyer ce contrat.'});
await rejects(()=>cmd('message',did,{kind:'contrat',body:'Pas de cotation'}),'contract requires quote');
await asUser(b);assert.equal((await db.query('select * from public.partner_quotes')).rows.length,0);assert.equal((await db.query('select * from public.partner_messages')).rows.length,0);assert.equal((await db.query('select * from public.crm_notifications')).rows.length,0);
await asUser(admin);const affair=(await db.query('select * from public.affaires')).rows[0];
await db.query(`insert into public.affaire_adv_checks(affaire_id,verification_calls,checked_by) values($1,true,$2)`,[affair.id,admin]);
await db.query('update public.affaires set commission=1000 where id=$1',[affair.id]);
await asUser(a);assert.equal((await db.query('select partner_commission from public.partner_quotes')).rows[0].partner_commission,null);
await asUser(admin);await db.query(`update public.affaires set stage='Signé',date_signature='2027-11-01' where id=$1`,[affair.id]);
await asUser(a);assert.equal(Number((await db.query('select partner_commission from public.partner_quotes')).rows[0].partner_commission),500);
assert.equal((await db.query('select * from public.affaire_adv_checks')).rows.length,0);
const notification=(await db.query('select * from public.crm_notifications limit 1')).rows[0];await cmd('read',notification.id);
assert.ok((await db.query('select read_at from public.crm_notifications where id=$1',[notification.id])).rows[0].read_at);
await asUser(admin);await db.query('update public.profiles set is_active=false where id=$1',[a]);await asUser(a);assert.equal((await db.query('select * from public.partner_dossiers')).rows.length,0);await rejects(()=>cmd('message',did,{body:'Test'}),'disabled user');
await asUser(commercial);
const prospect=(await db.query(`insert into public.prospects(raison_sociale,stage,assigned_to,created_by,pdl,pce) values('Commercial atomic test','RDV comparatif',$1,$1,'12345678901234','12345678901235') returning id`,[commercial])).rows[0];
const affaireId=(await db.query('select public.transfer_prospect_to_quote($1) as id',[prospect.id])).rows[0].id;
assert.equal((await db.query('select public.transfer_prospect_to_quote($1) as id',[prospect.id])).rows[0].id,affaireId,'retries reuse the same affaire');
assert.equal((await db.query('select count(*)::int n from public.affaires where prospect_id=$1',[prospect.id])).rows[0].n,1);
assert.equal((await db.query('select stage from public.prospects where id=$1',[prospect.id])).rows[0].stage,'Demande de cotation');
assert.ok((await db.query('select entered_conversion_at from public.prospects where id=$1',[prospect.id])).rows[0].entered_conversion_at);
await db.exec(`reset role;create function public.fail_quote_test() returns trigger language plpgsql as $$ begin if new.raison_sociale='Rollback test' then raise exception 'forced insert failure'; end if;return new;end $$;create trigger fail_quote_test before insert on public.affaires for each row execute function public.fail_quote_test();`);
await asUser(commercial);
const rollbackProspect=(await db.query(`insert into public.prospects(raison_sociale,stage,assigned_to,created_by) values('Rollback test','RDV comparatif',$1,$1) returning id`,[commercial])).rows[0];
await rejects(()=>db.query('select public.transfer_prospect_to_quote($1)',[rollbackProspect.id]),'failed affair insert rolls back the prospect transition');
assert.equal((await db.query('select stage from public.prospects where id=$1',[rollbackProspect.id])).rows[0].stage,'RDV comparatif');
assert.equal((await db.query('select count(*)::int n from public.affaires where prospect_id=$1',[rollbackProspect.id])).rows[0].n,0);
console.log('PASS: apporteur isolation and ACD → quote → ADV flow; commercial quote transfer is atomic and retry-safe');
await db.close();
