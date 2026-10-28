-- Les contrôles anciens restent disponibles sans rattachement explicite.
-- Une clé texte conserve l'historique même si une vente est rapprochée sous une nouvelle clé.
alter table public.quality_reviews add column sale_key text;
create index quality_reviews_sale_key_idx on public.quality_reviews(sale_key) where sale_key is not null;
