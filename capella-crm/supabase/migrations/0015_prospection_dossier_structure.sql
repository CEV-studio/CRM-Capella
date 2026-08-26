alter table public.prospects add column if not exists adresse_entreprise text;
alter table public.prospects add column if not exists ville text;

create table if not exists public.prospect_contacts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  nom text not null,
  prenom text not null,
  telephone text,
  email text,
  fonction text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_compteurs (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  type_energie text not null check (type_energie in ('electricite','gaz')),
  numero text not null,
  siret text,
  adresse text,
  code_postal text,
  ville text,
  segment text check (segment is null or segment in ('C5','C4','C3','C2')),
  date_echeance date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pieces_jointes add column if not exists compteur_id uuid references public.prospect_compteurs(id) on delete set null;

create index if not exists idx_prospect_contacts_prospect on public.prospect_contacts(prospect_id);
create index if not exists idx_prospect_compteurs_prospect on public.prospect_compteurs(prospect_id, type_energie);
create index if not exists idx_pieces_jointes_compteur on public.pieces_jointes(compteur_id);

alter table public.prospect_contacts enable row level security;
alter table public.prospect_compteurs enable row level security;

create policy prospect_contacts_select on public.prospect_contacts for select to authenticated using (
  exists (select 1 from public.prospects p where p.id = prospect_contacts.prospect_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_view_all())))
);
create policy prospect_contacts_write on public.prospect_contacts for all to authenticated using (
  exists (select 1 from public.prospects p where p.id = prospect_contacts.prospect_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
) with check (
  exists (select 1 from public.prospects p where p.id = prospect_contacts.prospect_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
);
create policy prospect_compteurs_select on public.prospect_compteurs for select to authenticated using (
  exists (select 1 from public.prospects p where p.id = prospect_compteurs.prospect_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_view_all())))
);
create policy prospect_compteurs_write on public.prospect_compteurs for all to authenticated using (
  exists (select 1 from public.prospects p where p.id = prospect_compteurs.prospect_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
) with check (
  exists (select 1 from public.prospects p where p.id = prospect_compteurs.prospect_id and p.deleted_at is null and (p.assigned_to = (select auth.uid()) or (select public.can_manage())))
);

create or replace function public.tg_dossier_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at = now(); return new; end; $$;
create trigger trg_prospect_contacts_updated_at before update on public.prospect_contacts for each row execute function public.tg_dossier_updated_at();
create trigger trg_prospect_compteurs_updated_at before update on public.prospect_compteurs for each row execute function public.tg_dossier_updated_at();