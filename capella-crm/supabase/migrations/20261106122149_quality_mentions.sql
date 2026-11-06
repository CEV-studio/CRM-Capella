alter table public.quality_incidents
 add column mentioned_ids uuid[] not null default '{}';

drop policy quality_incidents_read on public.quality_incidents;
create policy quality_incidents_read on public.quality_incidents for select to authenticated
 using ((select public.current_role_name()) in ('admin','qualite')
   or (select auth.uid()) = any(mentioned_ids));

create table public.quality_incident_comments (
 id uuid primary key default gen_random_uuid(),
 incident_id uuid not null references public.quality_incidents(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 author_name text not null,
 body text not null check (length(trim(body)) between 1 and 5000),
 mentioned_ids uuid[] not null default '{}',
 created_at timestamptz not null default now()
);
create index quality_incident_comments_incident_idx on public.quality_incident_comments(incident_id,created_at);
alter table public.quality_incident_comments enable row level security;
revoke all on public.quality_incident_comments from anon,authenticated;
grant select,insert on public.quality_incident_comments to authenticated;
create policy quality_incident_comments_read on public.quality_incident_comments for select to authenticated
 using (exists(select 1 from public.quality_incidents i where i.id=incident_id));
create policy quality_incident_comments_create on public.quality_incident_comments for insert to authenticated
 with check (author_id=(select auth.uid()) and exists(
  select 1 from public.quality_incidents i where i.id=incident_id));

create or replace function private.quality_incident_notify() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.crm_notifications(recipient_id,actor_id,title,body,href,email_to,email_status)
 select p.id,new.reporter_id,'Signalement qualité · '||new.title,
  left(new.reporter_name||' · '||new.description,300),
  '/qualite/signalements/'||new.id,p.email,'none'
 from public.profiles p
 where p.is_active and (p.role='admin' or p.id=any(new.mentioned_ids))
 and p.id is distinct from new.reporter_id;
 return new;
end $$;

create function private.quality_comment_notify() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.quality_incidents i
 set mentioned_ids=(select array_agg(distinct recipient) from unnest(i.mentioned_ids || new.mentioned_ids) recipient),
 updated_at=now()
 where i.id=new.incident_id and cardinality(new.mentioned_ids)>0;
 insert into public.crm_notifications(recipient_id,actor_id,title,body,href,email_to,email_status)
 select p.id,new.author_id,'Mention dans un signalement qualité',
  left(new.author_name||' · '||new.body,300),
  '/qualite/signalements/'||new.incident_id,p.email,'none'
 from public.profiles p
 where p.is_active and p.id=any(new.mentioned_ids) and p.id<>new.author_id;
 return new;
end $$;
revoke all on function private.quality_comment_notify() from public,anon,authenticated;
create trigger quality_comment_notify after insert on public.quality_incident_comments
 for each row execute function private.quality_comment_notify();
