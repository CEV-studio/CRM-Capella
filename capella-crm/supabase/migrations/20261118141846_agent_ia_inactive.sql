-- Reserve the Agent IA profile type without enabling an account before its
-- permissions and deletion safeguards have been implemented and audited.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','commercial','manager','apporteur','qualite','be_centre','be_agent','agent_ia'));
alter table public.profiles add constraint profiles_agent_ia_disabled_check
  check (role <> 'agent_ia' or is_active = false);
