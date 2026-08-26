-- Finalise l'unicite des messages Gmail par boite pour permettre les upserts PostgREST.
drop index if exists public.email_messages_account_message_unique;
alter table public.email_messages
  add constraint email_messages_account_message_unique unique (email_account_id, gmail_message_id);
