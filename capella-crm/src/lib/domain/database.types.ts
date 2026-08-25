/** Types manuels de la base Supabase — miroir des migrations. */
export type Role = "admin" | "commercial";
export type PaymentStatus = "À payer" | "Payé" | "En attente";
export type TypeEnergie = "Électricité" | "Gaz" | "Élec+Gaz";

export type Profile = { id:string; full_name:string; email:string; role:Role; commission_rate:number; is_active:boolean; must_change_password:boolean; can_export:boolean; can_view_all:boolean; can_manage_team:boolean; created_at:string; updated_at:string };
export type Source = { id:string; name:string; kind:"call_center"|"apporteur"|"fichier"|"web"|"autre"; is_active:boolean; created_at:string };
export type Apporteur = { id:string; name:string; contact:string|null; commission_rate:number; payment_status:PaymentStatus; is_active:boolean; created_at:string; updated_at:string };
export type Fournisseur = { id:string; name:string; is_active:boolean; sort_order:number };
export type ChampPersonnalise = { id:string; cle:string; libelle:string; created_at:string };
export type StageRow = { label:string; category:string; color:string; sort_order:number; quick_filter?:boolean };

export type Prospect = {
  id:string; ref:string|null; nom:string|null; prenom:string|null; mail:string|null; tel_mobile:string|null; tel_fixe:string|null;
  raison_sociale:string|null; siren:string|null; naf:string|null; code_postal:string|null; nb_sites:number|null; segment:string|null;
  pdl:string|null; pce:string|null; car_electricite:number|null; car_gaz:number|null; option_tarifaire:string|null;
  fournisseur_electricite:string|null; fournisseur_gaz:string|null; date_fin_contrat:string|null; champs_perso:Record<string,string>;
  stage:string; next_action:string|null; next_action_date:string|null; notes:string|null; score:number|null; last_action_at:string|null;
  source_id:string|null; assigned_to:string|null; assigned_at:string|null; deleted_at:string|null;
  siren_norm:string|null; pdl_norm:string|null; pce_norm:string|null; mobile_norm:string|null;
  legacy_ref:string|null; legacy_sheet:string|null; legacy_stage:string|null; legacy_payload:Record<string,unknown>;
  created_by:string|null; created_at:string; updated_at:string;
};

export type Affaire = {
  id:string; ref:string|null; commercial_id:string; apporteur_id:string|null; prospect_id:string|null; source_id:string|null;
  raison_sociale:string; adresse_conso:string|null; siren:string|null; nom:string|null; prenom:string|null; mail:string|null; telephone:string|null;
  fournisseur:string|null; type_energie:TypeEnergie|null; contrat:string|null; pdl_elec:string|null; pce_gaz:string|null; stage:string;
  date_debut:string|null; date_echeance:string|null; car_mwh:number|null; date_entree:string; date_signature:string|null; date_relance:string|null;
  commission:number; facture:string|null; acd:string|null; notes:string|null; deleted_at:string|null;
  legacy_ref:string|null; legacy_payload:Record<string,unknown>; created_by:string|null; created_at:string; updated_at:string;
};

export type PieceJointe = { id:string; type:"ACD"|"Facture"; prospect_id:string|null; affaire_id:string|null; bucket_path:string; file_name:string; mime:string|null; taille:number|null; uploaded_by:string|null; created_at:string };
export type LeadAssignment = { id:number; prospect_id:string; from_user:string|null; to_user:string|null; assigned_by:string|null; reason:string|null; created_at:string };
export type FormSubmission = { id:string; source:string; external_id:string; submitted_at:string|null; payload:Record<string,unknown>; affaire_id:string|null; processed_at:string|null; error:string|null; created_at:string };
export type ImportRun = { id:string; kind:string; source_name:string; mode:"dry-run"|"apply"; status:"started"|"completed"|"failed"; stats:Record<string,unknown>; error:string|null; created_by:string|null; created_at:string; completed_at:string|null };

type Writable<T, Generated extends keyof T = never> = Omit<T, Generated>;
export type ProspectInsert = Partial<Writable<Prospect,"id"|"ref"|"siren_norm"|"pdl_norm"|"pce_norm"|"mobile_norm"|"created_at"|"updated_at">>;
export type ProspectUpdate = ProspectInsert;
export type AffaireInsert = Partial<Writable<Affaire,"id"|"ref"|"created_at"|"updated_at">> & { raison_sociale:string; commercial_id:string };
export type AffaireUpdate = Partial<AffaireInsert>;
export type PieceJointeInsert = Partial<Writable<PieceJointe,"id"|"created_at">> & { type:"ACD"|"Facture"; bucket_path:string; file_name:string };

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = { Row:Row; Insert:Insert; Update:Update; Relationships:[] };

export interface Database {
  public: {
    Tables: {
      profiles:Table<Profile>;
      prospects:Table<Prospect,ProspectInsert,ProspectUpdate>;
      affaires:Table<Affaire,AffaireInsert,AffaireUpdate>;
      apporteurs:Table<Apporteur>;
      sources:Table<Source>;
      fournisseurs:Table<Fournisseur>;
      champs_personnalises:Table<ChampPersonnalise>;
      prospect_stages:Table<StageRow>;
      affaire_stages:Table<StageRow>;
      lead_assignments:Table<LeadAssignment>;
      pieces_jointes:Table<PieceJointe,PieceJointeInsert>;
      form_submissions:Table<FormSubmission>;
      import_runs:Table<ImportRun>;
    };
    Views:Record<never,never>;
    Functions:{
      is_admin:{ Args:Record<never,never>; Returns:boolean };
      can_view_all:{ Args:Record<never,never>; Returns:boolean };
      can_manage:{ Args:Record<never,never>; Returns:boolean };
      current_role_name:{ Args:Record<never,never>; Returns:string };
    };
    Enums:Record<never,never>;
    CompositeTypes:Record<never,never>;
  };
}
