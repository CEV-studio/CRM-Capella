create table public.quality_incidents (
 id uuid primary key default gen_random_uuid(),
 source text not null check (source in ('crm','email')),
 source_account_id uuid references public.email_accounts(id),
 source_message_id text,
 source_thread_id text,
 reporter_id uuid references public.profiles(id),
 reporter_name text not null check (length(trim(reporter_name)) between 1 and 120),
 title text not null check (length(trim(title)) between 1 and 180),
 description text not null check (length(trim(description)) between 1 and 10000),
 category text not null default 'autre' check (category in ('ecart_contrat','controle_a_refaire','autre')),
 sale_key text check (sale_key is null or length(sale_key) <= 160),
 client_name text check (client_name is null or length(client_name) <= 160),
 attachment_names text[] not null default '{}',
 status text not null default 'ouvert' check (status in ('ouvert','en_cours','resolu')),
 reported_at timestamptz not null default now(),
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint quality_incident_email_source check (
  (source='crm' and source_account_id is null and source_message_id is null)
  or (source='email' and source_account_id is not null and source_message_id is not null)
 ),
 unique (source_account_id,source_message_id)
);
create index quality_incidents_status_idx on public.quality_incidents(status,reported_at desc);
create index quality_incidents_sale_idx on public.quality_incidents(sale_key) where sale_key is not null;
alter table public.quality_incidents enable row level security;
revoke all on public.quality_incidents from anon,authenticated;
grant select,insert on public.quality_incidents to authenticated;
grant update(status,resolved_at,updated_at) on public.quality_incidents to authenticated;
create policy quality_incidents_read on public.quality_incidents for select to authenticated
 using ((select public.current_role_name()) in ('admin','qualite'));
create policy quality_incidents_create on public.quality_incidents for insert to authenticated
 with check ((select public.current_role_name()) in ('admin','qualite')
  and source='crm' and reporter_id=(select auth.uid()) and status='ouvert');
create policy quality_incidents_update on public.quality_incidents for update to authenticated
 using ((select public.current_role_name())='admin')
 with check ((select public.current_role_name())='admin');

alter table public.crm_notifications drop constraint crm_notifications_email_status_check;
alter table public.crm_notifications add constraint crm_notifications_email_status_check
 check (email_status in ('none','pending','sending','sent','failed'));
grant update(read_at) on public.crm_notifications to authenticated;
create policy crm_notifications_mark_read on public.crm_notifications for update to authenticated
 using ((select public.is_active_user()) and recipient_id=(select auth.uid()))
 with check ((select public.is_active_user()) and recipient_id=(select auth.uid()));

create function private.quality_incident_notify() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.crm_notifications(recipient_id,actor_id,title,body,href,email_to,email_status)
 select p.id,new.reporter_id,'Signalement qualité · '||new.title,
  left(new.reporter_name||' · '||new.description,300),
  '/qualite/signalements/'||new.id,p.email,'none'
 from public.profiles p where p.role='admin' and p.is_active;
 return new;
end $$;
revoke all on function private.quality_incident_notify() from public,anon,authenticated;
create trigger quality_incident_notify after insert on public.quality_incidents
 for each row execute function private.quality_incident_notify();
