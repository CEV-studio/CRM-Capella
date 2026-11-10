alter table public.be_centres add column archived_at timestamptz;
alter table public.be_sales_agents add column archived_at timestamptz;

create or replace function public.be_archive_agent(p_agent_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.be_sales_agents;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 select * into a from public.be_sales_agents where id=p_agent_id and archived_at is null for update;
 if not found then raise exception 'Agent introuvable'; end if;
 update public.profiles p set is_active=false where p.role='be_agent' and exists(select 1 from public.be_access b where b.user_id=p.id and b.centre=a.centre and lower(trim(b.agent_ref))=lower(trim(a.agent_ref)));
 update public.be_access set is_active=false where centre=a.centre and lower(trim(agent_ref))=lower(trim(a.agent_ref));
 update public.be_sales_agents set archived_at=now(),is_active=false where id=p_agent_id;
end $$;
revoke all on function public.be_archive_agent(uuid) from public,anon;
grant execute on function public.be_archive_agent(uuid) to authenticated;

create or replace function public.be_archive_centre(p_name text) returns void
language plpgsql security definer set search_path='' as $$
declare center_name text;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 select name into center_name from public.be_centres where name=p_name and archived_at is null for update;
 if not found then raise exception 'Centre introuvable'; end if;
 update public.profiles p set is_active=false where p.role in ('be_agent','be_centre') and exists(select 1 from public.be_access b where b.user_id=p.id and b.centre=center_name);
 update public.be_access set is_active=false where centre=center_name;
 update public.be_sales_agents set archived_at=now(),is_active=false where centre=center_name and archived_at is null;
 update public.be_centres set archived_at=now() where name=center_name;
end $$;
revoke all on function public.be_archive_centre(text) from public,anon;
grant execute on function public.be_archive_centre(text) to authenticated;
