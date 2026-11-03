import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.profiles(id uuid primary key, full_name text, role text not null, commission_rate numeric default 0, is_active boolean default true, can_export boolean default false, can_view_all boolean default false, can_manage_team boolean default false, manager_id uuid, archived_at timestamptz);
create table public.prospects(id uuid primary key, assigned_to uuid, stage text, deleted_at timestamptz);
create table public.affaires(id uuid primary key, commercial_id uuid, stage text, deleted_at timestamptz);
create function public.is_admin() returns boolean language sql security definer as $$select coalesce((select role='admin' and is_active from public.profiles where id=auth.uid()),false)$$;
create function public.can_manage() returns boolean language sql security definer as $$select coalesce((select role='admin' or can_manage_team from public.profiles where id=auth.uid()),false)$$;
grant usage on schema auth,public to authenticated; grant select on public.profiles,public.prospects,public.affaires to authenticated;
grant update on public.profiles to authenticated;`);
await db.exec(readFileSync('supabase/migrations/20261103215048_partner_teams.sql','utf8'));
await db.exec(`create trigger trg_profiles_protect before update on public.profiles for each row execute function public.tg_protect_profile_privileges();
insert into public.profiles(id,full_name,role) values
('00000000-0000-0000-0000-000000000001','Admin','admin'),
('00000000-0000-0000-0000-000000000002','Manager A','manager'),
('00000000-0000-0000-0000-000000000003','Commercial A','commercial'),
('00000000-0000-0000-0000-000000000004','Commercial B','commercial'),
('00000000-0000-0000-0000-000000000005','Manager B','manager');
insert into public.partner_teams(id,name,manager_id) values
('10000000-0000-0000-0000-000000000001','Equipe A','00000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000002','Equipe B','00000000-0000-0000-0000-000000000005');
update public.profiles set partner_team_id=case when full_name='Commercial A' then '10000000-0000-0000-0000-000000000001'::uuid else '10000000-0000-0000-0000-000000000002'::uuid end where role='commercial';
insert into public.prospects(id,assigned_to,stage) values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','Nouveau');
insert into public.affaires(id,commercial_id,stage) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','Signé');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); set role authenticated;`);
let result=await db.query('select * from public.partner_team_stats() order by team_id');
assert.equal(Number(result.rows[0].membres),1);assert.equal(Number(result.rows[0].prospects_actifs),1);assert.equal(Number(result.rows[0].dossiers_valides),1);assert.equal(Number(result.rows[1].prospects_actifs),0);
await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false)");
result=await db.query('select * from public.partner_teams');assert.equal(result.rows.length,0);
await assert.rejects(db.query('select * from public.partner_team_stats()'));
await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false)");
result=await db.query('select * from public.partner_teams');assert.equal(result.rows.length,0);
await assert.rejects(db.query('select * from public.partner_team_stats()'));
await db.exec("update public.profiles set partner_team_id='10000000-0000-0000-0000-000000000002' where id='00000000-0000-0000-0000-000000000003'");
result=await db.query("select partner_team_id from public.profiles where id='00000000-0000-0000-0000-000000000003'");assert.equal(result.rows[0].partner_team_id,'10000000-0000-0000-0000-000000000001');
console.log('PASS: team stats, team isolation and assignment protection.');await db.close();
