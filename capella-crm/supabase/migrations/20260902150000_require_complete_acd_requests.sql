alter table public.acd_requests
  add column if not exists company_address text,
  add column if not exists company_postal_code text,
  add column if not exists company_city text;

alter table public.acd_requests
  alter column company_address set not null,
  alter column company_postal_code set not null,
  alter column company_city set not null,
  add constraint acd_requests_company_postal_code_format check (company_postal_code ~ '^[0-9]{5}$'),
  add constraint acd_requests_required_text check (
    btrim(raison_sociale) <> '' and btrim(company_address) <> '' and btrim(company_city) <> '' and
    btrim(signatory_first_name) <> '' and btrim(signatory_last_name) <> '' and
    btrim(signatory_email) <> '' and btrim(signatory_phone) <> '' and btrim(signatory_role) <> ''
  );

alter table public.acd_request_meters
  alter column address set not null,
  alter column postal_code set not null,
  alter column city set not null,
  add constraint acd_request_meters_postal_code_format check (postal_code ~ '^[0-9]{5}$'),
  add constraint acd_request_meters_required_address check (btrim(address) <> '' and btrim(city) <> '');
