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
assert.equal((await db.query('select acd_status from public.partner_dossiers')).rows[0].acd_status,'en_preparation');
await rejects(()=>cmd('resend',did),'cannot resend before ADV sends the ACD');
await asUser(admin);await db.query("update public.acd_requests set status='envoyee' where prospect_id=$1",[pid]);
await asUser(a);assert.equal((await db.query('select acd_status from public.partner_dossiers')).rows[0].acd_status,'envoyee');
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

// Dedicated ADV role: actual PostgreSQL RLS, Storage and transactional RPC tests.
const adv='10000000-0000-4000-8000-000000000005';
await db.exec(`reset role;select set_config('request.jwt.claim.sub','${admin}',false);insert into auth.users(id,email,raw_user_meta_data) values('${adv}','adv@example.org','{"full_name":"ADV"}');
 update public.profiles set role='adv',commission_rate=0,must_change_password=false where id='${adv}';
 grant all on storage.objects to authenticated;`);
await asUser(adv);
assert.equal((await db.query('select public.is_admin() b')).rows[0].b,false);
assert.equal((await db.query('select public.can_manage() b')).rows[0].b,false);
assert.equal((await db.query('select public.can_view_all() b')).rows[0].b,false);
assert.ok((await db.query('select * from public.adv_directory()')).rows.some(p=>p.id===commercial));
assert.equal((await db.query('select * from public.profiles')).rows.length,1,'ADV has only its own full profile');
assert.ok((await db.query('select * from public.acd_requests')).rows.length);
assert.ok((await db.query('select * from public.acd_request_meters')).rows.length);
assert.ok((await db.query('select * from public.partner_dossiers')).rows.length);
assert.ok((await db.query('select * from public.partner_messages')).rows.length);
assert.equal((await db.query('select * from public.prospects where id=$1',[rollbackProspect.id])).rows.length,0,'unrelated prospect hidden');
await rejects(()=>db.query('select public.transfer_prospect_to_quote($1)',[rollbackProspect.id]),'ADV cannot use commercial transfer endpoint');
assert.equal((await db.query("update public.affaires set commercial_id=$1 where id=$2 returning id",[adv,affair.id])).rows.length,0,'no reassignment by REST');
assert.equal((await db.query("update public.affaires set commission=123 where id=$1 returning id",[affair.id])).rows.length,0,'no arbitrary REST update');
await rejects(()=>db.query("insert into public.affaires(commercial_id,raison_sociale) values($1,'Forbidden')",[adv]),'ADV cannot create arbitrary sale');
await rejects(()=>cmd('draft','20000000-0000-4000-8000-000000000099',payload),'ADV cannot create partner account dossiers');
await rejects(()=>cmd('submit',did,payload),'ADV cannot submit in place of partner');
await rejects(()=>cmd('resend',did),'ADV cannot use partner resend');
await rejects(()=>db.query("select public.adv_save($1,'KO',100,null,null,null)",[affair.id]),'ADV cannot decide KO');
await rejects(()=>db.query("select public.adv_save($1,'Signé',0,null,null,null)",[affair.id]),'signed dossier requires commission');
await rejects(()=>db.query("select public.adv_save($1,'Signé','NaN',null,null,null)",[affair.id]),'NaN commission rejected');
await db.query("select public.adv_save($1,'Signé',1500,'2026-11-20','2026-12-01',true)",[affair.id]);
assert.equal(Number((await db.query('select commission from public.affaires where id=$1',[affair.id])).rows[0].commission),1500);
assert.equal((await db.query('select verification_calls from public.affaire_adv_checks where affaire_id=$1',[affair.id])).rows[0].verification_calls,true);
await db.query('select public.adv_acd_download($1)',[pid]);
await cmd('documents',did);await cmd('message',did,{body:'Traitement ADV'});
await db.query("insert into storage.objects(bucket_id,name) values('pieces-jointes',$1)",[`prospects/${pid}/adv.pdf`]);
await db.query("insert into public.pieces_jointes(type,prospect_id,bucket_path,file_name) values('ACD',$1,$2,'adv.pdf')",[pid,`prospects/${pid}/adv.pdf`]);
assert.equal((await db.query('select * from storage.objects')).rows.length,1);
await rejects(()=>db.query("insert into storage.objects(bucket_id,name) values('pieces-jointes',$1)",[`prospects/${rollbackProspect.id}/forbidden.pdf`]),'unrelated storage path');
await rejects(()=>db.query("insert into storage.objects(bucket_id,name) values('other','forbidden')"),'unrelated bucket');
await rejects(()=>db.query("insert into public.pieces_jointes(type,prospect_id,bucket_path,file_name) values('ACD',$1,$2,'forbidden.pdf')",[pid,`prospects/${rollbackProspect.id}/forbidden.pdf`]),'forged document reference');
assert.equal((await db.query("update public.profiles set is_active=false where id=$1 returning id",[commercial])).rows.length,0);
await rejects(()=>db.query("update public.profiles set role='admin' where id=$1",[adv]),'ADV cannot escalate its own role');
for(const table of ['email_accounts','be_contracts','partner_teams','sources','lead_assignments']) assert.equal((await db.query('select * from public.'+table)).rows.length,0,table+' hidden');
// Preserve partner notifications and commissions, include ADV as recipient.
await asUser(admin);await db.query('update public.profiles set is_active=true where id=$1',[a]);
await asUser(a);assert.equal(Number((await db.query('select partner_commission from public.partner_quotes where id=$1',[qid])).rows[0].partner_commission),750);
await cmd('quote',did,{...quote,request_key:'30000000-0000-4000-8000-000000000002'});
await asUser(adv);const received=(await db.query('select * from public.crm_notifications')).rows;
assert.ok(received.some(n=>n.title==='Nouvelle demande de cotation'&&n.recipient_id===adv));
await rejects(()=>db.query("update public.crm_notifications set email_to='attacker@example.org' where id=$1",[received[0].id]),'ADV cannot forge email recipients');
await db.query('update public.crm_notifications set read_at=now() where id=$1',[received[0].id]);
assert.equal((await db.query('select read_at from public.crm_notifications where id=$1',[received[0].id])).rows[0].read_at!==null,true);
// An ordinary ACD creates one quotation; failed creation rolls the entire transition back.
await asUser(commercial);
const rawAcd=await db.query(`insert into public.acd_requests(prospect_id,requested_by,raison_sociale,siren,siret,company_address,company_postal_code,company_city,signatory_first_name,signatory_last_name,signatory_email,signatory_phone,signatory_capacity,signatory_role)
 values($1,$2,'Commercial atomic test','123456789','12345678900011','1 rue Test','75002','Paris','Test','Client','client@example.org','0612345678','representant_legal','Gérant') returning id`,[prospect.id,commercial]);
const rawId=rawAcd.rows[0].id;
const failingId=(await db.query(`insert into public.acd_requests(prospect_id,requested_by,raison_sociale,siren,siret,company_address,company_postal_code,company_city,signatory_first_name,signatory_last_name,signatory_email,signatory_phone,signatory_capacity,signatory_role)
 values($1,$2,'Rollback test','123456789','12345678900011','1 rue Test','75002','Paris','Test','Client','client@example.org','0612345678','representant_legal','Gérant') returning id`,[rollbackProspect.id,commercial])).rows[0].id;
await asUser(adv);
await rejects(()=>db.query("select public.adv_acd_status($1,'invalid')",[rawId]),'invalid ACD status');
await db.query("select public.adv_acd_status($1,'en_cours')",[rawId]);
await db.query("select public.adv_acd_status($1,'terminee')",[rawId]);await db.query("select public.adv_acd_status($1,'terminee')",[rawId]);
assert.equal((await db.query('select count(*)::int n from public.affaires where prospect_id=$1',[prospect.id])).rows[0].n,1,'idempotent non-partner ACD');
assert.equal((await db.query('select processed_by from public.acd_requests where id=$1',[rawId])).rows[0].processed_by,adv);
await rejects(()=>db.query("select public.adv_acd_status($1,'terminee')",[failingId]),'ACD failure rolls back entire command');
assert.equal((await db.query('select status from public.acd_requests where id=$1',[failingId])).rows[0].status,'a_traiter');
assert.equal((await db.query('select stage from public.prospects where id=$1',[rollbackProspect.id])).rows[0].stage,'RDV comparatif');
await asUser(admin);await db.query("update public.prospects set raison_sociale='Successful new ACD' where id=$1",[rollbackProspect.id]);
await asUser(adv);await db.query("select public.adv_acd_status($1,'terminee')",[failingId]);await db.query("select public.adv_acd_status($1,'terminee')",[failingId]);
assert.equal((await db.query('select count(*)::int n from public.affaires where prospect_id=$1',[rollbackProspect.id])).rows[0].n,1,'creates one new quotation');
// ACD signature on partner dossiers keeps the existing explicit quote workflow.
const partnerAcd=(await db.query('select acd_request_id from public.partner_dossiers where id=$1',[did])).rows[0].acd_request_id;
const before=(await db.query('select count(*)::int n from public.affaires')).rows[0].n;
await db.query("select public.adv_acd_status($1,'envoyee')",[partnerAcd]);await db.query("select public.adv_acd_status($1,'terminee')",[partnerAcd]);
assert.equal((await db.query('select count(*)::int n from public.affaires')).rows[0].n,before);
assert.equal((await db.query('select acd_status from public.partner_dossiers where id=$1',[did])).rows[0].acd_status,'signee');
// Commercial and disabled accounts cannot invoke any operational command.
await asUser(commercial);
await rejects(()=>db.query('select * from public.adv_directory()'),'directory forbidden to commercial');
await rejects(()=>db.query('update public.affaires set commission=999 where id=$1',[affaireId]),'commercial cannot change own commission through REST');
await rejects(()=>db.query("update public.affaires set stage='Signé' where id=$1",[affaireId]),'commercial cannot validate own signed dossier through REST');
await rejects(()=>db.query("insert into public.affaires(commercial_id,raison_sociale,commission) values($1,'Forged commission',100)",[commercial]),'commercial cannot insert privileged commission');
// Ordinary sales edits and KO handling still work.
await db.query("update public.affaires set notes='Commercial note',date_relance='2026-12-10' where id=$1",[affaireId]);
await db.query("update public.affaires set stage='KO',ko_reason='Test' where id=$1",[affaireId]);
await db.query("update public.affaires set stage='Demande de cotation' where id=$1",[affaireId]);

await rejects(()=>db.query("select public.adv_save($1,'Signé',1200,null,null,true)",[affair.id]),'commercial cannot perform ADV operation');
await rejects(()=>db.query("select public.adv_acd_status($1,'terminee')",[rawId]),'commercial cannot process ACD');
await rejects(()=>db.query('select public.adv_acd_download($1)',[pid]),'commercial cannot record download');
await asUser(admin);await db.query('update public.profiles set is_active=false where id=$1',[adv]);
await asUser(adv);
for(const table of ['affaires','prospects','acd_requests','acd_request_meters','partner_dossiers','pieces_jointes','crm_notifications']) assert.equal((await db.query('select * from public.'+table)).rows.length,0,'disabled '+table);
assert.equal((await db.query('select * from storage.objects')).rows.length,0,'disabled storage');
await rejects(()=>db.query('select * from public.adv_directory()'),'disabled directory');
await rejects(()=>db.query("select public.adv_save($1,'Signé',1000,null,null,true)",[affair.id]),'disabled ADV save');
await rejects(()=>db.query("select public.adv_acd_status($1,'terminee')",[rawId]),'disabled ACD status');
await rejects(()=>cmd('message',did,{body:'Disabled'}),'disabled partner command');
await asUser(admin);await db.query("select public.adv_save($1,'Signé',1500,'2026-11-20',null,true)",[affair.id]);
assert.ok((await db.query('select * from public.profiles')).rows.length>=5,'admin retains full account access');
console.log('PASS: ADV active/disabled, commercial/admin; direct RLS and Storage isolation; ACD atomicity, partner documents, quotations, notifications and commissions');
await db.close();
