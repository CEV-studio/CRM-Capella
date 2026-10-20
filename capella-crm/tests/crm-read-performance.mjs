import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.on('uncaughtException',e=>{console.error('TEST FAILED:',e.message,e.where??'');process.exit(1);});
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema public,auth,storage to authenticated,anon,service_role;
grant execute on all functions in schema auth to authenticated;
alter default privileges in schema public grant all on tables to authenticated,service_role;`);
for (const file of fs.readdirSync(root + '/supabase/migrations').sort()) {
  await db.exec(fs.readFileSync(root + '/supabase/migrations/' + file, 'utf8').replace(/create extension if not exists "pgcrypto";/g, ''));
}
await db.exec('grant all on all sequences in schema public to authenticated,service_role;');
const admin='10000000-0000-4000-8000-000000000001', a='10000000-0000-4000-8000-000000000002', b='10000000-0000-4000-8000-000000000003', partner='10000000-0000-4000-8000-000000000004', disabled='10000000-0000-4000-8000-000000000005';
for (const [i,id] of [admin,a,b,partner,disabled].entries()) await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{\"full_name\":\"Test\"}')",[id,`test${i}@example.org`]);
await db.query("update public.profiles set role='commercial', can_view_all=false,can_manage_team=false");
await db.query("update public.profiles set role='admin' where id=$1",[admin]);
await db.query("update public.profiles set role='apporteur' where id=$1",[partner]);
await db.query('update public.profiles set is_active=false where id=$1',[disabled]);
console.log('Fixtures: profiles ready');
const source=(await db.query("insert into public.sources(name,kind) values('Volume test','autre') returning id")).rows[0].id;
await db.query(`insert into public.prospects(raison_sociale,source_id,date_fin_contrat)
 select 'Bulk '||lpad(n::text,4,'0'),$1,((now() at time zone 'Europe/Paris')::date + interval '12 months')::date from generate_series(1,1250) n`,[source]);
console.log('Fixtures: 1250 leads ready');
const today="(now() at time zone 'Europe/Paris')::date";
for (const [name,expression,owner] of [
 ['Past',`${today}-1`,a],['Today',today,a],['Between',`(${today}+interval '12 months')::date+1`,a],
 ['Eighteen',`(${today}+interval '18 months')::date`,a],['Later',`(${today}+interval '18 months')::date+1`,a],
 ['Other owner',`${today}+1`,b],['Meter company',`${today}+1`,a],['Archived meter fallback',`${today}+2`,a],['No deadline','null',a]
]) await db.query(`insert into public.prospects(raison_sociale,assigned_to,date_fin_contrat) values($1,$2,${expression})`,[name,owner]);
await db.query(`insert into public.prospects(raison_sociale,assigned_to,date_fin_contrat,deleted_at) values('Deleted',$1,${today},now())`,[a]);
await db.exec(`insert into public.prospect_compteurs(prospect_id,type_energie,numero,date_echeance)
 select id,'electricite','99999999999991',${today} from public.prospects where raison_sociale='Meter company';
 insert into public.prospect_compteurs(prospect_id,type_energie,numero,date_echeance)
 select id,'gaz','99999999999992',(${today}+interval '18 months')::date from public.prospects where raison_sociale='Meter company';
 insert into public.prospect_compteurs(prospect_id,type_energie,numero,date_echeance,archived_at)
 select id,'electricite','99999999999993',${today}-5,now() from public.prospects where raison_sociale='Archived meter fallback';`);
async function asUser(id) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); }
async function deadlines(period='toutes',q='',page=1) { return (await db.query('select public.crm_deadlines_page($1,$2,$3) as result',[period,q,page])).rows[0].result; }
async function summary() { return (await db.query('select public.crm_prospect_summary() as result')).rows[0].result; }
await db.exec('analyze');
console.log('Fixtures complete');
await asUser(admin);
let d=await deadlines();console.log('First deadline page ready');
assert.equal(d.total,1259); assert.equal(d.rows.length,50); assert.equal(d.totalPages,26);
assert.deepEqual(d.counts,{toutes:1259,retard:1,alerte:1257,zeroDouze:1254,douzeDixHuit:3,plusTard:1});
assert.equal((await deadlines('toutes','',9999)).page,26);assert.equal((await deadlines('toutes','',9999)).rows.length,9);
const keys=new Set();for(let page=1;page<=26;page++){for(const row of (await deadlines('toutes','',page)).rows) {assert.ok(!keys.has(row.key),'page overlap');keys.add(row.key);}}
assert.equal(keys.size,1259);
for(const [period,total] of [['retard',1],['0_12',1254],['12_18',3],['18_plus',1]]) assert.equal((await deadlines(period)).total,total);
assert.equal((await deadlines('toutes','PDL 99999999999991')).total,1);
assert.equal((await deadlines('toutes','Meter company')).total,2,'meters replace the general date');
assert.equal((await deadlines('toutes','Archived meter fallback')).rows[0].kind,'Contrat');
assert.equal((await deadlines('toutes','%')).total,0,'search treats wildcard characters literally');
assert.equal((await deadlines('toutes','Does not exist',999)).page,1);
let stats=await summary();assert.equal(stats.stages.reduce((n,s)=>n+s.total,0),1259,'all live prospects, including undated, excluding deleted');
assert.equal((await db.query('select sum(total)::int as n from public.crm_reservoir_counts()')).rows[0].n,1250);
console.log('PASS pagination > 1000, complete aggregates, boundaries, multiple meters, archived and deleted rows');
await asUser(a); d=await deadlines();assert.equal(d.total,8);assert.equal((await deadlines('toutes','Other owner')).total,0);
stats=await summary();assert.equal(stats.stages.reduce((n,s)=>n+s.total,0),8);assert.ok(stats.owners.every(o=>o.assigned_to===a));
await assert.rejects(()=>db.query('select * from public.crm_reservoir_counts()'));
await asUser(b);assert.equal((await deadlines()).total,1);
for(const id of [partner,disabled]) {await asUser(id);await assert.rejects(()=>deadlines());await assert.rejects(()=>summary());await assert.rejects(()=>db.query('select * from public.crm_reservoir_counts()'));}
await db.exec('reset role;set role anon');await assert.rejects(()=>deadlines());await assert.rejects(()=>summary());
console.log('PASS commercial isolation, partner and disabled-account denial, anonymous denial');
await db.close();
