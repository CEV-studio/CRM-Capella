-- Owner-scoped notification policies already restrict reads and read receipts.
-- The old blanket rule excluded quality users from their own notifications.
drop policy if exists quality_deny_direct on public.crm_notifications;
