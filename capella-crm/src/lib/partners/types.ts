export type Meter = { energy_type:'electricite'|'gaz'; identifier:string; contract_expiry?:string; address?:string; postal_code?:string; city?:string };
export type Details = Record<string,string|Meter[]> & { meters:Meter[] };
export type Dossier = { id:string; owner_id:string; prospect_id:string; company_name:string; siret:string; details:Details; acd_status:'brouillon'|'envoyee'|'signee'|'annulee'; acd_request_id:string|null; created_at:string };
export type Quote = { id:string; dossier_id:string; affaire_id:string; start_date:string; end_date:string; quote_date:string; meters:Meter[]; status:string; supplier:string|null; signed_at:string|null; partner_commission:number|null; comment:string; is_regie:boolean; offer_market:boolean; offer_other:boolean; created_at:string };
export const acdLabels={brouillon:'Brouillon',envoyee:'ACD envoyée',signee:'ACD signée',annulee:'ACD annulée'};
