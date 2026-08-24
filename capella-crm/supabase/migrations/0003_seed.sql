-- ================================================================
--  CAPELLA ENERGY — CRM : DONNÉES DE RÉFÉRENCE
--  Migration 0003
-- ================================================================
--  Étapes, couleurs, fournisseurs, sources.
--  Les libellés sont exactement ceux du CRM Google Sheets actuel :
--  les commerciaux ne doivent rien réapprendre.
-- ================================================================

-- ---- Étapes de PROSPECTION -------------------------------------
insert into public.prospect_stages (label, category, color, sort_order) values
  ('NRP',                'actif',        '#FFF3CD',  1),
  ('Rappels',            'actif',        '#FFF3CD',  2),
  ('Demande de facture', 'actif',        '#E3EFFF',  3),
  ('Demande ACD',        'actif',        '#E3EFFF',  4),
  ('RDV comparatif',     'a_transferer', '#E3F5EE',  5),
  ('Présentation',       'a_transferer', '#E3EFFF',  6),
  ('RIB',                'a_transferer', '#E3F5EE',  7),
  ('DFF trop éloigné',   'clos',         '#FFD9D9',  8),
  ('KO',                 'clos',         '#FFD9D9',  9),
  ('Numéro KO',          'clos',         '#FFD9D9', 10),
  ('Pas intéressé',      'clos',         '#FFD9D9', 11)
on conflict (label) do update
  set category = excluded.category,
      color = excluded.color,
      sort_order = excluded.sort_order;

-- ---- Étapes de CONVERSION --------------------------------------
insert into public.affaire_stages (label, category, color, sort_order) values
  ('Demande de cotation', 'actif', '#E3EFFF', 1),
  ('Comparatif',          'actif', '#E3EFFF', 2),
  ('RDV',                 'actif', '#E3F5EE', 3),
  ('RIB',                 'actif', '#E3F5EE', 4),
  ('Signé',               'gagne', '#C6EFCE', 5),
  ('KO',                  'perdu', '#FFD9D9', 6)
on conflict (label) do update
  set category = excluded.category,
      color = excluded.color,
      sort_order = excluded.sort_order;

-- ---- Fournisseurs ----------------------------------------------
insert into public.fournisseurs (name, sort_order) values
  ('Vattenfall',    1),
  ('Engie',         2),
  ('TotalEnergies', 3),
  ('EDF',           4),
  ('Primeo',        5),
  ('Alpiq',         6),
  ('Axpo',          7),
  ('Endesa',        8),
  ('Eneffic',       9),
  ('Dyneff',       10),
  ('Autre',        11)
on conflict (name) do nothing;

-- ---- Sources de leads ------------------------------------------
-- Point de départ : les canaux actuels. L'admin en ajoutera d'autres.
insert into public.sources (name, kind) values
  ('Call center Maroc',   'call_center'),
  ('Call center Tunisie', 'call_center'),
  ('Apporteur',           'apporteur'),
  ('Fichier acheté',      'fichier'),
  ('Google Maps',         'fichier'),
  ('Site web',            'web'),
  ('Autre',               'autre')
on conflict (name) do nothing;
