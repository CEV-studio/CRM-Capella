create table public.quality_review_comments (
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null references public.quality_reviews(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 author_name text not null,
 body text not null check (length(trim(body)) between 1 and 5000),
 mentioned_ids uuid[] not null default '{}' check (cardinality(mentioned_ids) <= 20),
 created_at timestamptz not null default now()
);
create index quality_review_comments_review_idx on public.quality_review_comments(review_id,created_at,id);
alter table public.quality_review_comments enable row level security;
revoke all on public.quality_review_comments from anon,authenticated;
grant select,insert on public.quality_review_comments to authenticated;
create policy quality_review_comments_read on public.quality_review_comments for select to authenticated
 using (exists(select 1 from public.quality_reviews r where r.id=review_id));
create policy quality_review_comments_insert on public.quality_review_comments for insert to authenticated
 with check (author_id=(select auth.uid()) and (select public.is_active_user())
  and exists(select 1 from public.quality_reviews r where r.id=review_id));

create function private.quality_review_comment_notify() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if cardinality(new.mentioned_ids)>0 then
  update public.quality_reviews r
  set mentioned_ids=(select array_agg(distinct u.id) from unnest(r.mentioned_ids || new.mentioned_ids) as u(id))
  where r.id=new.review_id;
 end if;
 insert into public.crm_notifications(recipient_id,actor_id,title,body,href,email_to,email_status)
 select p.id,new.author_id,'Nouveau commentaire sur un contrôle qualité',
  left(new.author_name||' · '||new.body,300),'/qualite/'||new.review_id,p.email,'none'
 from public.profiles p
 where p.is_active and p.id<>new.author_id and p.id in (
  select r.controller_id from public.quality_reviews r where r.id=new.review_id
  union select unnest(r.mentioned_ids) from public.quality_reviews r where r.id=new.review_id
  union select c.author_id from public.quality_review_comments c where c.review_id=new.review_id and c.id<>new.id
  union select unnest(c.mentioned_ids) from public.quality_review_comments c where c.review_id=new.review_id and c.id<>new.id
 );
 return new;
end $$;
revoke all on function private.quality_review_comment_notify() from public,anon,authenticated;
create trigger quality_review_comment_notify after insert on public.quality_review_comments
 for each row execute function private.quality_review_comment_notify();
