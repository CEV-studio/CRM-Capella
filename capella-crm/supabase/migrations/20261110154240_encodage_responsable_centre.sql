alter table public.be_sale_entries add column encoded_by uuid references public.profiles(id);

create or replace function public.be_centre_agents() returns table(agent_id uuid,display_name text)
language sql stable security definer set search_path='' as $$
 select s.id,s.display_name from public.be_sales_agents s
 join public.be_access a on a.centre=s.centre and a.user_id=auth.uid() and a.is_active and a.agent_ref is null
 join public.profiles p on p.id=a.user_id and p.is_active and not p.must_change_password and p.role='be_centre'
 where s.is_active and s.archived_at is null order by s.display_name,s.id
$$;
revoke all on function public.be_centre_agents() from public,anon;
grant execute on function public.be_centre_agents() to authenticated;

create or replace function public.be_encode_sale_for_agent(p_data jsonb,p_agent_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor public.profiles; membership public.be_access; agent public.be_sales_agents; chosen public.be_products; owner uuid; energy_value text; result uuid; comment_body text;
begin
 select * into actor from public.profiles where id=auth.uid() and is_active and role='be_centre' and not must_change_password;
 select * into membership from public.be_access where user_id=actor.id and is_active and agent_ref is null;
 select * into agent from public.be_sales_agents where id=p_agent_id and centre=membership.centre and is_active and archived_at is null;
 if actor.id is null or membership.user_id is null or agent.id is null then raise exception 'Accès encodage refusé' using errcode='42501'; end if;
 select * into chosen from public.be_products where is_active and id::text=p_data->>'product_id';
 if chosen.id is null then raise exception 'Sélectionne un produit actif'; end if;
 energy_value:=case chosen.kind when 'energy' then p_data->>'energy' when 'telecom' then 'Telecom' else 'Autre' end;
 if chosen.kind='energy' and (energy_value is null or energy_value not in ('Elec','Gaz')) then raise exception 'Énergie requise'; end if;
 comment_body:=trim(coalesce(p_data->>'comment',''));
 if length(comment_body)>5000 then raise exception 'Commentaire trop long'; end if;
 select a.user_id into owner from public.be_access a join public.profiles p on p.id=a.user_id and p.role='be_agent' where a.centre=membership.centre and lower(trim(a.agent_ref))=lower(trim(agent.agent_ref)) limit 1;
 insert into public.be_sale_entries(owner_id,owner_name,encoded_by,agent_ref,centre,mega_id,energy,ean,contract_reference,first_name,last_name,phone,email,product,product_id,submission_id)
 values(coalesce(owner,actor.id),agent.display_name,actor.id,agent.agent_ref,membership.centre,null,energy_value,'','',trim(p_data->>'first_name'),trim(p_data->>'last_name'),trim(p_data->>'phone'),lower(trim(p_data->>'email')),chosen.label,chosen.id,coalesce(nullif(p_data->>'submission_id','')::uuid,gen_random_uuid())) returning id into result;
 if comment_body<>'' then perform private.be_save_comment(null,'CRM:'||result::text,membership.centre,comment_body);end if;
 return result;
end $$;
revoke all on function public.be_encode_sale_for_agent(jsonb,uuid) from public,anon;
grant execute on function public.be_encode_sale_for_agent(jsonb,uuid) to authenticated;

-- When a referenced agent later receives a login, attach manager-encoded sales to it.
create or replace function private.be_attach_centre_sales() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.agent_ref is not null and exists(select 1 from public.profiles where id=new.user_id and role='be_agent') then
  update public.be_sale_entries s set owner_id=new.user_id
  where s.centre=new.centre and lower(trim(s.agent_ref))=lower(trim(new.agent_ref)) and s.encoded_by is not null
    and exists(select 1 from public.profiles p where p.id=s.owner_id and p.role='be_centre');
 end if;
 return new;
end $$;
create trigger be_attach_centre_sales after insert on public.be_access for each row execute function private.be_attach_centre_sales();
