alter table public.quality_reviews
 add column mentioned_ids uuid[] not null default '{}',
 add column client_key text;
create index quality_reviews_client_key_idx on public.quality_reviews(client_key,reviewed_at desc) where client_key is not null;

drop policy quality_read on public.quality_reviews;
create policy quality_read on public.quality_reviews for select to authenticated
 using ((select public.current_role_name()) in ('admin','qualite')
   or (select auth.uid()) = any(mentioned_ids));

create function private.quality_review_mention_notify() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.crm_notifications(recipient_id,actor_id,title,body,href,email_to,email_status)
 select p.id,new.controller_id,'Mention dans un contrôle qualité',
  left(new.controller_name||' · '||coalesce(new.comments,''),300),
  '/qualite/'||new.id,p.email,'none'
 from public.profiles p
 where p.is_active and p.id=any(new.mentioned_ids) and p.id<>new.controller_id;
 return new;
end $$;
revoke all on function private.quality_review_mention_notify() from public,anon,authenticated;
create trigger quality_review_mention_notify after insert on public.quality_reviews
 for each row execute function private.quality_review_mention_notify();
