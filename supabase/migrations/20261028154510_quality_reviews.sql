create table public.quality_reviews (
  id uuid primary key default gen_random_uuid(),
  activity_name text not null check (length(trim(activity_name)) between 1 and 120),
  rubric_key text not null default 'mega_call_v1',
  agent_name text not null check (length(trim(agent_name)) between 1 and 120),
  sale_reference text not null check (length(trim(sale_reference)) between 1 and 160),
  identification jsonb not null default '{}'::jsonb check (jsonb_typeof(identification)='object'),
  condition_context jsonb not null default '{}'::jsonb check (jsonb_typeof(condition_context)='object'),
  answers jsonb not null check (jsonb_typeof(answers)='object'),
  score_sum integer not null check (score_sum >= 0),
  applicable_count integer not null check (applicable_count between 1 and 18),
  score_percent numeric(7,4) not null check (score_percent between 0 and 100),
  status text not null check (status in ('Conforme','À consolider','Insuffisant','Non conforme — faute grave')),
  grave_faults jsonb not null default '[]'::jsonb check (jsonb_typeof(grave_faults)='array'),
  call_quality_note text,
  comments text,
  controller_id uuid not null references public.profiles(id),
  controller_name text not null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint quality_score_matches check (score_percent = round(score_sum::numeric * 100 / (4 * applicable_count), 4)),
  constraint quality_status_matches check (
    (jsonb_array_length(grave_faults)>0 and status='Non conforme — faute grave') or
    (jsonb_array_length(grave_faults)=0 and ((score_percent>=90 and status='Conforme') or (score_percent>=75 and score_percent<90 and status='À consolider') or (score_percent<75 and status='Insuffisant')))
  )
);

create index quality_reviews_reviewed_at_idx on public.quality_reviews(reviewed_at desc);
create index quality_reviews_status_idx on public.quality_reviews(status);
create index quality_reviews_controller_idx on public.quality_reviews(controller_id,reviewed_at desc);
create index quality_reviews_activity_idx on public.quality_reviews(activity_name,reviewed_at desc);
create index quality_reviews_agent_idx on public.quality_reviews(agent_name,reviewed_at desc);
create index quality_reviews_sale_idx on public.quality_reviews(activity_name,sale_reference);

alter table public.quality_reviews enable row level security;
revoke all on public.quality_reviews from anon;
grant select,insert on public.quality_reviews to authenticated;
create policy quality_read on public.quality_reviews for select to authenticated
  using ((select public.current_role_name()) in ('admin','qualite'));
create policy quality_insert on public.quality_reviews for insert to authenticated
  with check ((select public.current_role_name()) in ('admin','qualite') and controller_id=(select auth.uid()));

comment on table public.quality_reviews is 'Contrôles qualité des ventes avec réponses détaillées et preuves de faute grave.';
