-- Run as the database owner. Every fixture and business mutation is rolled back.
begin;
select set_config('request.jwt.claim.sub','',true);
do $$
declare adv_id uuid:=gen_random_uuid(); commercial_id uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid(); pid uuid; rid uuid; aid uuid;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (adv_id,'adv-smoke-'||adv_id||'@example.invalid','{"full_name":"ADV smoke fixture"}'),
 (commercial_id,'commercial-smoke-'||commercial_id||'@example.invalid','{"full_name":"Commercial smoke fixture"}'),
 (admin_id,'admin-smoke-'||admin_id||'@example.invalid','{"full_name":"Admin smoke fixture"}');
 update public.profiles set role='adv',commission_rate=0,must_change_password=false where id=adv_id;
 update public.profiles set role='admin',must_change_password=false where id=admin_id;
 insert into public.prospects(raison_sociale,assigned_to,created_by) values('ADV transaction smoke fixture',commercial_id,commercial_id) returning id into pid;
 insert into public.acd_requests(prospect_id,requested_by,raison_sociale,siren,siret,company_address,company_postal_code,company_city,signatory_first_name,signatory_last_name,signatory_email,signatory_phone,signatory_capacity,signatory_role)
 values(pid,commercial_id,'ADV transaction smoke fixture','123456789','12345678900011','1 rue Test','75002','Paris','Test','Fixture','fixture@example.invalid','0612345678','representant_legal','Gérant') returning id into rid;
 perform set_config('test.adv_id',adv_id::text,true);perform set_config('test.commercial_id',commercial_id::text,true);perform set_config('test.admin_id',admin_id::text,true);perform set_config('test.prospect_id',pid::text,true);perform set_config('test.acd_id',rid::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.adv_id'),true);
set local role authenticated;
do $$
declare pid uuid:=current_setting('test.prospect_id')::uuid; rid uuid:=current_setting('test.acd_id')::uuid; aid uuid; n integer;
begin
 if public.is_admin() or public.can_manage() or public.can_view_all() then raise exception 'ADV inherited administration'; end if;
 if not exists(select 1 from public.acd_requests where id=rid) then raise exception 'ADV cannot read ACD'; end if;
 perform public.adv_acd_status(rid,'terminee');perform public.adv_acd_status(rid,'terminee');
 select count(*),min(id::text)::uuid into n,aid from public.affaires where prospect_id=pid;
 if n<>1 then raise exception 'ACD quotation not idempotent'; end if;
 perform public.adv_save(aid,'Signé',1000,current_date,current_date+7,true);
 if not exists(select 1 from public.affaire_adv_checks where affaire_id=aid and verification_calls) then raise exception 'ADV checks failed'; end if;
 update public.affaires set commission=999 where id=aid;
 get diagnostics n=row_count;if n<>0 then raise exception 'Arbitrary ADV REST write allowed'; end if;
 begin update public.profiles set role='admin' where id=auth.uid();raise exception 'ADV escalation accepted';exception when insufficient_privilege then null;end;
 perform set_config('test.affaire_id',aid::text,true);
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.commercial_id'),true);
set local role authenticated;
do $$
begin
 begin update public.affaires set commission=999 where id=current_setting('test.affaire_id')::uuid;raise exception 'Commercial direct commission accepted';exception when insufficient_privilege then null;end;
 begin perform public.adv_save(current_setting('test.affaire_id')::uuid,'Signé',2000,current_date,null,true);raise exception 'Commercial ADV save accepted';exception when insufficient_privilege then null;end;
 begin perform public.adv_acd_status(current_setting('test.acd_id')::uuid,'terminee');raise exception 'Commercial ACD status accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.profiles set is_active=false where id=current_setting('test.adv_id')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.adv_id'),true);
set local role authenticated;
do $$
begin
 if exists(select 1 from public.acd_requests where id=current_setting('test.acd_id')::uuid) then raise exception 'Disabled ADV can read';end if;
 begin perform public.adv_acd_status(current_setting('test.acd_id')::uuid,'terminee');raise exception 'Disabled ADV accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.admin_id'),true);
set local role authenticated;
do $$
begin
 if not public.is_admin() then raise exception 'Admin lost access';end if;
 perform public.adv_save(current_setting('test.affaire_id')::uuid,'Signé',1200,current_date,null,false);
end $$;
reset role;
rollback;
select 'PASS: production PostgreSQL ADV active/disabled, commercial/admin, ACD quotation, commission, call checks, escalation refusal; all fixtures rolled back' as result;
