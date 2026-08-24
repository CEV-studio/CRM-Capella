-- ================================================================
--  CAPELLA ENERGY — CRM : TEST D'ISOLATION DES DONNÉES
-- ================================================================
--  Ce script prouve qu'un commercial ne peut PAS accéder aux données
--  d'un autre, même en écrivant lui-même ses requêtes.
--
--  Mode d'emploi (Supabase > SQL Editor) :
--    1. Colle tout ce fichier, clique Run  -> installe la fonction de test
--    2. Dans une nouvelle requête :   select * from public.test_rls();
--    3. Lis la colonne « ok » : toutes les lignes doivent afficher true.
--
--  Le test crée ses propres comptes fictifs (emails en @rlstest.local),
--  vérifie, puis efface tout derrière lui.
-- ================================================================

create or replace function public.test_rls()
returns table (test text, attendu text, obtenu text, ok boolean)
language plpgsql
volatile
as $$
declare
  id_admin  uuid := '00000000-0000-4000-a000-0000000000a1';
  id_alice  uuid := '00000000-0000-4000-a000-0000000000a2';
  id_bob    uuid := '00000000-0000-4000-a000-0000000000a3';
  id_zoe    uuid := '00000000-0000-4000-a000-0000000000a4';  -- compte désactivé
  p_alice   uuid;
  p_bob     uuid;
  p_reservoir uuid;
  a_bob     uuid;
  pj_id     uuid;
  n         int;
  v         numeric;
  r         text;
  msg       text;
begin
  -- ------------------------------------------------------------
  -- NETTOYAGE PRÉALABLE (au cas où un test précédent a échoué)
  -- ------------------------------------------------------------
  delete from public.affaires  where raison_sociale like 'RLSTEST%';
  delete from public.prospects where raison_sociale like 'RLSTEST%';
  delete from auth.users       where email like '%@rlstest.local';

  -- ------------------------------------------------------------
  -- PRÉPARATION : 4 comptes fictifs
  -- ------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (id_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@rlstest.local', '', now(), now(), '{}',
     jsonb_build_object('full_name', 'Test Admin', 'role', 'admin')),
    (id_alice, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'alice@rlstest.local', '', now(), now(), '{}',
     jsonb_build_object('full_name', 'Test Alice', 'role', 'commercial')),
    (id_bob,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'bob@rlstest.local',   '', now(), now(), '{}',
     jsonb_build_object('full_name', 'Test Bob', 'role', 'commercial')),
    (id_zoe,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'zoe@rlstest.local',   '', now(), now(), '{}',
     jsonb_build_object('full_name', 'Test Zoe', 'role', 'commercial'));

  update public.profiles set commission_rate = 0.70 where id = id_alice;
  update public.profiles set is_active = false   where id = id_zoe;

  -- Données : 2 prospects à Alice, 1 à Bob, 1 dans le réservoir.
  insert into public.prospects (raison_sociale, assigned_to, stage)
  values ('RLSTEST Alice 1', id_alice, 'NRP') returning id into p_alice;
  insert into public.prospects (raison_sociale, assigned_to, stage)
  values ('RLSTEST Alice 2', id_alice, 'Rappels');
  insert into public.prospects (raison_sociale, assigned_to, stage)
  values ('RLSTEST Bob 1', id_bob, 'NRP') returning id into p_bob;
  insert into public.prospects (raison_sociale, assigned_to, stage)
  values ('RLSTEST Reservoir', null, 'NRP') returning id into p_reservoir;

  insert into public.affaires (raison_sociale, commercial_id, stage)
  values ('RLSTEST Affaire Alice', id_alice, 'Comparatif');
  insert into public.affaires (raison_sociale, commercial_id, stage)
  values ('RLSTEST Affaire Bob', id_bob, 'RDV') returning id into a_bob;

  -- ============================================================
  --  TESTS SOUS L'IDENTITÉ D'ALICE (commerciale)
  -- ============================================================
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_alice, 'role', 'authenticated')::text, true);

  select count(*) into n from public.prospects;
  return query select
    'Alice ne voit que ses prospects'::text, '2'::text, n::text, n = 2;

  select count(*) into n from public.prospects where raison_sociale = 'RLSTEST Bob 1';
  return query select
    'Alice ne voit pas le prospect de Bob'::text, '0'::text, n::text, n = 0;

  select count(*) into n from public.prospects where raison_sociale = 'RLSTEST Reservoir';
  return query select
    'Alice ne voit pas le réservoir de leads'::text, '0'::text, n::text, n = 0;

  select count(*) into n from public.affaires;
  return query select
    'Alice ne voit que ses affaires'::text, '1'::text, n::text, n = 1;

  select count(*) into n from public.profiles;
  return query select
    'Alice ne voit que sa propre fiche'::text, '1'::text, n::text, n = 1;

  select count(*) into n from public.lead_assignments;
  return query select
    'Alice ne voit pas le journal d''attribution'::text, '0'::text, n::text, n = 0;

  -- Tentative de vol : s'attribuer le prospect de Bob.
  update public.prospects set assigned_to = id_alice where id = p_bob;
  get diagnostics n = row_count;
  return query select
    'Alice ne peut pas voler un lead de Bob'::text, '0 ligne'::text,
    n::text || ' ligne(s)', n = 0;

  -- Tentative de don : céder son prospect à Bob (bloqué par le WITH CHECK).
  begin
    update public.prospects set assigned_to = id_bob where id = p_alice;
    get diagnostics n = row_count;
    return query select
      'Alice ne peut pas céder un lead à Bob'::text, 'refusé'::text,
      case when n = 0 then 'refusé' else 'ACCEPTÉ (' || n || ')' end, n = 0;
  exception when insufficient_privilege or check_violation then
    return query select
      'Alice ne peut pas céder un lead à Bob'::text, 'refusé'::text, 'refusé'::text, true;
  end;

  -- Tentative d'auto-promotion.
  begin
    update public.profiles set role = 'admin', commission_rate = 1.0 where id = id_alice;
  exception when others then null;
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_alice, 'role', 'authenticated')::text, true);
  select role, commission_rate into r, v from public.profiles where id = id_alice;
  return query select
    'Alice ne peut pas se promouvoir admin'::text, 'commercial'::text, r, r = 'commercial';
  return query select
    'Alice ne peut pas changer son taux'::text, '0.7000'::text, v::text, v = 0.70;

  -- Tentative de création d'un prospect au nom de Bob.
  begin
    insert into public.prospects (raison_sociale, assigned_to, stage)
    values ('RLSTEST Fraude', id_bob, 'NRP');
    return query select
      'Alice ne peut pas créer un lead pour Bob'::text, 'refusé'::text, 'ACCEPTÉ'::text, false;
  exception when insufficient_privilege or check_violation then
    return query select
      'Alice ne peut pas créer un lead pour Bob'::text, 'refusé'::text, 'refusé'::text, true;
  end;

  -- ============================================================
  --  TESTS SOUS L'IDENTITÉ DE ZOE (compte désactivé)
  -- ============================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_zoe, 'role', 'authenticated')::text, true);

  select count(*) into n from public.prospects;
  return query select
    'Un compte désactivé ne voit aucun prospect'::text, '0'::text, n::text, n = 0;

  select count(*) into n from public.affaires;
  return query select
    'Un compte désactivé ne voit aucune affaire'::text, '0'::text, n::text, n = 0;

  -- ============================================================
  --  TESTS SOUS L'IDENTITÉ DE L'ADMIN
  -- ============================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);

  select count(*) into n from public.prospects where raison_sociale like 'RLSTEST%';
  return query select
    'L''admin voit tous les prospects, réservoir compris'::text, '4'::text, n::text, n = 4;

  select count(*) into n from public.affaires where raison_sociale like 'RLSTEST%';
  return query select
    'L''admin voit toutes les affaires'::text, '2'::text, n::text, n = 2;

  -- Réattribution par l'admin : le lead de Bob passe à Alice.
  update public.prospects set assigned_to = id_alice where id = p_bob;
  get diagnostics n = row_count;
  return query select
    'L''admin peut réattribuer un lead'::text, '1 ligne'::text,
    n::text || ' ligne(s)', n = 1;

  select count(*) into n from public.lead_assignments la
    join public.prospects p on p.id = la.prospect_id
   where p.raison_sociale like 'RLSTEST%';
  -- 3 attributions initiales (le lead du réservoir n'a pas de propriétaire)
  -- + 1 réattribution ci-dessus = 4 lignes de journal.
  return query select
    'Chaque attribution est tracée dans le journal'::text, '4'::text, n::text, n = 4;

  -- ============================================================
  --  RÈGLES MÉTIER
  -- ============================================================
  begin
    update public.prospects
       set stage = 'DFF trop éloigné', date_fin_contrat = null
     where id = p_alice;
    return query select
      '« DFF trop éloigné » exige une date de fin'::text, 'refusé'::text, 'ACCEPTÉ'::text, false;
  exception when check_violation then
    return query select
      '« DFF trop éloigné » exige une date de fin'::text, 'refusé'::text, 'refusé'::text, true;
  end;

  update public.affaires set stage = 'Signé' where id = a_bob;
  return query select
    'Passage à « Signé » : date remplie automatiquement'::text,
    current_date::text,
    coalesce((select date_signature::text from public.affaires where id = a_bob), 'vide'),
    (select date_signature from public.affaires where id = a_bob) = current_date;

  -- ============================================================
  --  v1.1 : PERMISSIONS, CORBEILLE, PIÈCES JOINTES
  --  (on est toujours sous l'identité de l'admin)
  -- ============================================================

  -- Une pièce jointe sur un prospect d'Alice.
  insert into public.pieces_jointes (type, prospect_id, bucket_path, file_name)
  values ('ACD', p_alice, 'prospects/'||p_alice||'/x.pdf', 'x.pdf')
  returning id into pj_id;

  -- Un prospect d'Alice mis à la corbeille.
  insert into public.prospects (raison_sociale, assigned_to, stage)
  values ('RLSTEST Corbeille Alice', id_alice, 'NRP');
  update public.prospects set deleted_at = now()
   where raison_sociale = 'RLSTEST Corbeille Alice';

  -- ---- « Voir tous les leads » ----
  update public.profiles set can_view_all = true where id = id_bob;
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_bob, 'role', 'authenticated')::text, true);
  select count(*) into n from public.prospects where raison_sociale like 'RLSTEST%';
  return query select
    'Bob « voir tous » voit les leads d''Alice'::text, '>=2'::text,
    n::text, n >= 2;
  -- La corbeille reste invisible, même avec « voir tous ».
  select count(*) into n from public.prospects
   where raison_sociale = 'RLSTEST Corbeille Alice';
  return query select
    'La corbeille reste invisible même en « voir tous »'::text, '0'::text,
    n::text, n = 0;
  -- Il voit aussi la pièce jointe d'Alice.
  select count(*) into n from public.pieces_jointes where id = pj_id;
  return query select
    'Bob « voir tous » voit les pièces jointes d''Alice'::text, '1'::text,
    n::text, n = 1;

  -- ---- Sans « voir tous », l'isolation des pièces jointes tient ----
  -- On repasse admin pour retirer la permission (Bob ne peut pas la retirer
  -- lui-même — c'est justement ce que protège le trigger).
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);
  update public.profiles set can_view_all = false where id = id_bob;
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_bob, 'role', 'authenticated')::text, true);
  select count(*) into n from public.pieces_jointes where id = pj_id;
  return query select
    'Bob standard ne voit pas la pièce jointe d''Alice'::text, '0'::text,
    n::text, n = 0;

  -- ---- « Gérer l'équipe » ----
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_admin, 'role', 'authenticated')::text, true);
  update public.profiles set can_manage_team = true where id = id_bob;
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_bob, 'role', 'authenticated')::text, true);
  select count(*) into n from public.lead_assignments;
  return query select
    'Bob « gérer l''équipe » lit le journal d''attribution'::text, '>=1'::text,
    n::text, n >= 1;

  -- ---- Auto-octroi refusé pour un commercial standard ----
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_alice, 'role', 'authenticated')::text, true);
  begin
    update public.profiles set can_view_all = true where id = id_alice;
  exception when others then null;
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', id_alice, 'role', 'authenticated')::text, true);
  return query select
    'Alice ne peut pas s''octroyer « voir tous »'::text, 'false'::text,
    (select can_view_all::text from public.profiles where id = id_alice),
    (select can_view_all from public.profiles where id = id_alice) = false;

  -- ------------------------------------------------------------
  --  NETTOYAGE
  -- ------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', null, true);
  delete from public.affaires  where raison_sociale like 'RLSTEST%';
  delete from public.prospects where raison_sociale like 'RLSTEST%';
  delete from auth.users       where email like '%@rlstest.local';

exception when others then
  -- En cas de plantage, on nettoie quand même et on remonte l'erreur.
  get stacked diagnostics msg = message_text;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  delete from public.affaires  where raison_sociale like 'RLSTEST%';
  delete from public.prospects where raison_sociale like 'RLSTEST%';
  delete from auth.users       where email like '%@rlstest.local';
  return query select 'ERREUR PENDANT LE TEST'::text, 'aucune'::text, msg, false;
end;
$$;

comment on function public.test_rls() is
  'Vérifie l''isolation des données entre commerciaux. Lancer : select * from public.test_rls();';
