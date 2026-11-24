begin;
-- Descriptive labels only. Existing permission arrays remain untouched.
alter table public.profiles add column labels text[] not null default '{}';
update public.profiles set labels=case role
 when 'admin' then array['Administrateur']
 when 'commercial' then array['Commercial']
 when 'manager' then case when hierarchy_title='Leader' then array['Leader'] else array['Manager'] end
 when 'apporteur' then array['Apporteur d’affaires']
 when 'adv' then array['ADV']
 when 'qualite' then array['Responsable qualité']
 when 'be_centre' then array['Responsable de centre']
 when 'be_agent' then array['Agent de centre']
 when 'agent_ia' then array['Agent IA']
 else case when nullif(btrim(role),'') is null then '{}'::text[] else array[left(btrim(role),60)] end end;
create function private.valid_account_labels(p_labels text[]) returns boolean
language sql immutable set search_path='' as $$
 select p_labels is not null and cardinality(p_labels)<=12 and not exists(
  select 1 from unnest(p_labels) label where label is null or length(btrim(label))=0 or length(label)>60 or label~'[[:cntrl:]]'
 );
$$;
revoke all on function private.valid_account_labels(text[]) from public,anon;
grant usage on schema private to service_role;
grant execute on function private.valid_account_labels(text[]) to authenticated,service_role;
alter table public.profiles add constraint profiles_labels_valid check(private.valid_account_labels(labels));
create function private.set_profile_labels(p_id uuid,p_labels text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_permission('administration') then raise exception 'Administration requise' using errcode='42501';end if;
 if not private.valid_account_labels(p_labels) then raise exception 'Étiquettes invalides';end if;
 update public.profiles set labels=coalesce((select array_agg(distinct btrim(label) order by btrim(label)) from unnest(p_labels) label),'{}') where id=p_id and archived_at is null;
 if not found then raise exception 'Compte introuvable';end if;
end $$;
create function public.set_profile_labels(p_id uuid,p_labels text[]) returns void
language sql security invoker set search_path='' as $$select private.set_profile_labels(p_id,p_labels);$$;
revoke all on function private.set_profile_labels(uuid,text[]),public.set_profile_labels(uuid,text[]) from public,anon;
grant execute on function private.set_profile_labels(uuid,text[]),public.set_profile_labels(uuid,text[]) to authenticated;
comment on column public.profiles.labels is 'Free descriptive labels. They never grant, revoke or imply any permission.';
commit;
