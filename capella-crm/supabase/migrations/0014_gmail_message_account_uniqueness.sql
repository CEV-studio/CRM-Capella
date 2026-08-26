-- CAPELLA CRM — un identifiant Gmail est propre a une boite
alter table public.email_messages drop constraint if exists email_messages_gmail_message_id_key;
create unique index if not exists email_messages_account_message_unique
  on public.email_messages(email_account_id, gmail_message_id)
  where email_account_id is not null;
create index if not exists idx_email_messages_message_id
  on public.email_messages(gmail_message_id);
