alter table public.prospects
  add column if not exists score_ellipro numeric;

comment on column public.prospects.score_ellipro is
  'Score Ellipro importé depuis la source historique, distinct du score CRM interne.';
