alter table public.prospects
  add column if not exists sans_engagement boolean not null default false;

alter table public.affaires
  add column if not exists sans_engagement boolean not null default false;
