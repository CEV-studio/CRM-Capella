alter table public.acd_requests
  drop constraint if exists acd_requests_status_check;
alter table public.acd_requests
  add constraint acd_requests_status_check
  check (status = any (array['a_traiter','en_cours','envoyee','terminee','annulee']));

alter table public.partner_dossiers
  drop constraint if exists partner_dossiers_acd_status_check;
alter table public.partner_dossiers
  add constraint partner_dossiers_acd_status_check
  check (acd_status = any (array['brouillon','en_preparation','envoyee','signee','annulee']));
