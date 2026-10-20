export type Contract = {
 key:string; supplier:string; mega_id:string; ean:string; reference:string; client:string; agent:string; centre:string;
 energy:string; status:string; status_class:string; registered_date:string|null; effect_date:string|null;
 period:string|null; period_confirmed:boolean; payment:string; report_date:string; clawback_end:string|null;
 gross_cents:number; centre_cents:number;
};
export type Statement = {key:string;supplier:string;period:string;gross_cents:number;centre_cents:number;status:string};
export type Invoice = {id:string;supplier:string;centre:string;period:string;reference:string;amount_cents:number;lines:Record<string,unknown>[];state:string;issued_at:string|null;paid_at:string|null;created_at:string};
export type ImportRun = {id:string;kind:string;source:string;report_date:string;row_count:number;created_at:string;fingerprint:string};
export const norm=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const text=(v:unknown)=>String(v??'').trim();
export function dateValue(v:unknown):string|null {
 if(v===null||v===undefined||v==='')return null;
 if(v instanceof Date)return v.toISOString().slice(0,10);
 const s=text(v);
 if(/^\d{5}(\.\d+)?$/.test(s)||typeof v==='number')return new Date(Date.UTC(1899,11,30)+Math.floor(Number(v))*86400000).toISOString().slice(0,10);
 if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10)==='0000-00-00'?null:s.slice(0,10);
 const fr=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(fr)return `${fr[3]}-${fr[2]}-${fr[1]}`;
 const us=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s|$)/);if(us)return `20${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
 throw new Error(`Date non reconnue : ${s}`);
}
export function money(v:unknown){if(v===null||v===undefined||v==='')throw new Error('Montant manquant');const n=typeof v==='number'?v:Number(text(v).replace(/[\s€\u202f]/g,'').replace(',','.'));if(!Number.isFinite(n))throw new Error(`Montant invalide : ${v}`);return Math.round(n*100);}
export function classify(s:string){const n=norm(s);return n.includes('resili')?'Résilié':n.includes('annul')?'Annulé':n.includes('rejet')?'Rejeté':n==='incomplete'?'Incomplet':n==='contrateffectif'?'Effectif':n.includes('salledattente')?'Salle d’attente':n.includes('attente')&&n.includes('valid')?'En attente':'En cours';}
export function addMonths(s:string,n:number){const d=new Date(s+'T00:00:00Z');const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);}
export const energyCode=(energy:unknown)=>norm(energy)==='gaz'?'GAZ':'ELEC';
export const keyOf=(id:unknown,ean:unknown,energy:unknown='Elec')=>`MEGA:${text(id)}:${text(ean)}:${energyCode(energy)}`;
export const monthOf=(date:string|null)=>date?date.slice(0,7)+'-01':null;
export const euros=(cents:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100);
export function parseRows(rows:unknown[][],kind:'report'|'statement',reportDate:string,statementPeriod:string): (Contract|Statement)[] {
 const hi=rows.findIndex(r=>r.some(c=>['id','idmega'].includes(norm(c)))&&r.some(c=>norm(c)==='ean'));
 if(hi<0)throw new Error('Colonnes ID et EAN introuvables. Utiliser un reporting MEGA ou le registre central.');
 const headers=rows[hi].map(norm);const seen=new Set<string>();
 return rows.slice(hi+1).filter(r=>r.some(c=>text(c)!=='')).map((r,i)=>{
 const get=(...keys:string[])=>{for(const k of keys){const ix=headers.indexOf(norm(k));if(ix>=0&&r[ix]!==null&&r[ix]!==undefined&&r[ix]!=='')return r[ix];}return null;};
 const id=text(get('id','ID Mega')),ean=text(get('EAN'));
 const status=text(get('Statut Mega actuel','Statut','Statut Mega'));
 const product=text(get('Produit Inscription'));
 const clientType=text(get('individual','Type de client'));
 if(clientType&&norm(clientType)!=='residentiel')throw new Error(`Barème non configuré pour le type de client : ${clientType}`);
 const energy=text(get('Énergie','contract_type'))||(product.startsWith('NG_')?'Gaz':product.startsWith('EL_')?'Elec':'');
 if(!['elec','electricite','gaz'].includes(norm(energy)))throw new Error(`Énergie absente ou inconnue : ${id}`);
 const pending=!ean&&norm(status)==='incomplete'&&['elec','electricite','gaz'].includes(norm(energy));
 if(typeof get('EAN')==='number'||!/^\d+$/.test(id)||(!pending&&!/^\d{18}$/.test(ean)))throw new Error(`Ligne ${hi+i+2} : ID/EAN invalide. L’EAN doit rester du texte (18 chiffres).`);
 const key=ean?keyOf(id,ean,energy):`MEGA:${id}:PENDING:${norm(energy)==='gaz'?'GAZ':'ELEC'}`;if(seen.has(key))throw new Error(`Doublon dans le fichier : ${key}`);seen.add(key);
 if(kind==='statement'){
 const period=monthOf(dateValue(get('Période de commissionnement','Période commissionnement')))||statementPeriod;
 if(!/^\d{4}-\d{2}-01$/.test(period))throw new Error('Période de facturation requise');
 const gross_cents=money(get('Total Commission','Brut Mega retenu (€)'));
 const bonus=money(get('Domiciliation','Bonus domiciliation Mega (€)')??0);
 const suppliedCentre=get('Part TILIRA (€)','Part centre (€)');
 if(suppliedCentre===null&&![0,6500,7500].includes(gross_cents))throw new Error(`Part centre requise pour ce montant fournisseur : ${gross_cents/100} €`);
 return {key,supplier:'MEGA',period,gross_cents,centre_cents:suppliedCentre!==null?money(suppliedCentre):gross_cents===0?0:3000+(bonus>0?500:0),status};
 }
 const agent=text(get('Agent','Agent Mega','Vendeur'));if(!agent)throw new Error(`Agent absent pour ${key}`);
 const explicitCentre=text(get('Centre'));
 const centre=norm(agent)==='houssamterazi'?'Cimsourse':explicitCentre||'TILIRA';
 if(!['TILIRA','Cimsourse'].includes(centre))throw new Error(`Centre inconnu : ${centre}`);
 const status_class=classify(status);if(!status)throw new Error(`Statut absent pour ${key}`);
 const registered_date=dateValue(get('Inscription','DateInscription','Date d’inscription'));
 const observed=dateValue(get('Effet observé (provisoire)','Start Date'));
 const effect_date=observed||(status_class==='Effectif'?reportDate:null);
 const period=monthOf(dateValue(get('Période commissionnement','Période de commissionnement')))||monthOf(effect_date);
 const payment=text(get('Type de paiement','Domiciliation','Domiciliation (Mega)'));
 const complete=norm(payment).includes('complete');const active=status_class==='Effectif';
 return {key,supplier:'MEGA',mega_id:id,ean,reference:text(get('Référence contrat','ContratNbr','Numéro de contrat','Référence contrat Mega')).replace(/[',]/g,''),client:text(get('Client'))||[text(get('nom','Nom client')),text(get('prenom','Prénom client'))].filter(Boolean).join(' '),agent,centre,energy,status,status_class,registered_date,effect_date,period,period_confirmed:false,payment,report_date:reportDate,clawback_end:dateValue(get('Fin clawback estimée'))||(effect_date?addMonths(effect_date,3):null),gross_cents:active?6500+(complete?1000:0):0,centre_cents:active?3000+(complete?500:0):0};
 });
}
export function retained(c:Contract,statements:Statement[]){const s=statements.filter(s=>s.key===c.key).sort((a,b)=>b.period.localeCompare(a.period))[0];return {period:s?.period??c.period,gross_cents:s?.gross_cents??c.gross_cents,centre_cents:s?.centre_cents??c.centre_cents,confirmed:!!s};}
export function summarize(contracts:Contract[],statements:Statement[],period:string|null,today:string){
 const selected=contracts.filter(c=>!period||retained(c,statements).period===period);const active=selected.filter(c=>c.status_class==='Effectif');
 const sums=active.reduce((a,c)=>{const v=retained(c,statements);a.gross+=v.gross_cents;a.centre+=v.centre_cents;return a;},{gross:0,centre:0});
 return {...sums,capella:sums.gross-sums.centre,active:active.length,atRisk:active.filter(c=>!!c.clawback_end&&c.clawback_end>today).length,unknownDates:active.filter(c=>!c.effect_date||!c.clawback_end).length,waiting:selected.filter(c=>c.status_class==='En attente').length,room:selected.filter(c=>c.status_class==='Salle d’attente').length,cancelled:selected.filter(c=>c.status_class==='Annulé').length,terminated:selected.filter(c=>c.status_class==='Résilié').length};
}

export type CycleTracking = {
 contract_key:string;effect_date:string|null;termination_date:string|null;completed_at:string|null;
 bonus_invoiced_at:string|null;bonus_paid_at:string|null;
 centre_recovered_cents:number;mega_recovered_cents:number;notes:string;updated_at:string;
};
export type SupplierBilling = {
 supplier:string;period:string;call_received_at:string|null;invoiced:boolean;invoiced_at:string|null;
 invoice_reference:string|null;received_cents:number;received_at:string|null;notes:string;updated_at:string;
};
