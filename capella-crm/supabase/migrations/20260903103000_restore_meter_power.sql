-- La puissance de compteur présente dans les imports historiques doit rester
-- distincte des consommations annuelles de référence (CAR).
alter table public.prospects
  add column if not exists puissance text;
