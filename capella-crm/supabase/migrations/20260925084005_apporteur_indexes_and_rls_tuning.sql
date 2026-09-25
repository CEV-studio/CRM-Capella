-- Cover foreign keys used by the apporteur portal and ADV checks.
create index if not exists affaire_adv_checks_checked_by on public.affaire_adv_checks(checked_by);
create index if not exists crm_notifications_dossier on public.crm_notifications(dossier_id);
create index if not exists partner_dossiers_acd_request on public.partner_dossiers(acd_request_id);
create index if not exists partner_messages_author on public.partner_messages(author_id);
create index if not exists partner_messages_quote on public.partner_messages(quote_id);

-- Evaluate auth helpers once per statement instead of once per visible row.
drop policy if exists crm_notifications_read on public.crm_notifications;
create policy crm_notifications_read on public.crm_notifications
  for select to authenticated
  using ((select public.is_active_user()) and recipient_id = (select auth.uid()));

drop policy if exists partner_dossiers_read on public.partner_dossiers;
create policy partner_dossiers_read on public.partner_dossiers
  for select to authenticated
  using (
    (select public.is_active_user())
    and ((select public.is_admin()) or owner_id = (select auth.uid()))
  );
