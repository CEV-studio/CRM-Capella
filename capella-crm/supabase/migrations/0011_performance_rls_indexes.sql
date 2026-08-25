-- CAPELLA CRM — optimisations de performance sans changement fonctionnel

-- Les appels auth.* et helpers de droits sont évalués une seule fois par requête
-- au lieu d'être recalculés pour chaque ligne examinée par les politiques RLS.

alter policy profiles_admin_all on public.profiles
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter policy profiles_select_self_or_admin on public.profiles
  using ((id = (select auth.uid())) or (select public.is_admin()));

alter policy profiles_update_self on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy prospects_manage_all on public.prospects
  using ((select public.can_manage()))
  with check ((select public.can_manage()));

alter policy prospects_insert_own on public.prospects
  with check ((select public.is_active_user()) and assigned_to = (select auth.uid()));

alter policy prospects_select_own on public.prospects
  using (
    (select public.is_active_user())
    and deleted_at is null
    and (assigned_to = (select auth.uid()) or (select public.can_view_all()))
  );

alter policy prospects_update_own on public.prospects
  using ((select public.is_active_user()) and assigned_to = (select auth.uid()))
  with check (assigned_to = (select auth.uid()));

alter policy affaires_manage_all on public.affaires
  using ((select public.can_manage()))
  with check ((select public.can_manage()));

alter policy affaires_insert_own on public.affaires
  with check ((select public.is_active_user()) and commercial_id = (select auth.uid()));

alter policy affaires_select_own on public.affaires
  using (
    (select public.is_active_user())
    and deleted_at is null
    and (commercial_id = (select auth.uid()) or (select public.can_view_all()))
  );

alter policy affaires_update_own on public.affaires
  using ((select public.is_active_user()) and commercial_id = (select auth.uid()))
  with check (commercial_id = (select auth.uid()));

alter policy email_messages_read on public.email_messages
  using (
    (select public.can_view_all())
    or exists (
      select 1
      from public.prospects p
      where p.id = email_messages.prospect_id
        and p.deleted_at is null
        and p.assigned_to = (select auth.uid())
    )
  );

alter policy email_messages_insert on public.email_messages
  with check (
    (select public.can_view_all())
    or exists (
      select 1
      from public.prospects p
      where p.id = email_messages.prospect_id
        and p.deleted_at is null
        and p.assigned_to = (select auth.uid())
    )
  );

-- Index correspondant aux parcours les plus fréquents du CRM :
-- liste par commercial / dernière action et navigation fiche précédente-suivante.
create index if not exists idx_prospects_owner_last_action
  on public.prospects (assigned_to, last_action_at desc, id)
  where deleted_at is null;

create index if not exists idx_prospects_last_action_live
  on public.prospects (last_action_at desc, id)
  where deleted_at is null;

create index if not exists idx_prospects_owner_navigation
  on public.prospects (assigned_to, created_at, id)
  where deleted_at is null;

-- FK utilisées par l'historique email et les documents.
create index if not exists idx_email_messages_account
  on public.email_messages (email_account_id)
  where email_account_id is not null;

create index if not exists idx_email_messages_triggered_by
  on public.email_messages (triggered_by)
  where triggered_by is not null;

create index if not exists idx_pieces_jointes_uploaded_by
  on public.pieces_jointes (uploaded_by)
  where uploaded_by is not null;
