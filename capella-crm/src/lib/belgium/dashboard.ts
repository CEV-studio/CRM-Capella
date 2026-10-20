import { retained, type Contract, type Statement } from './domain';
export type DashboardScope = { view:'global'|'year'|'month';year:number;month:number };
export const STATUS_SERIES = [
 {key:'Effectif',label:'Effectifs',color:'#059669',soft:'#ecfdf5'},
 {key:'Salle d’attente',label:'Salle d’attente',color:'#f59e0b',soft:'#fffbeb'},
 {key:'Annulé',label:'Annulés',color:'#ef4444',soft:'#fef2f2'},
 {key:'Résilié',label:'Résiliés',color:'#8b5cf6',soft:'#f5f3ff'},
 {key:'En attente',label:'Validation client',color:'#0ea5e9',soft:'#f0f9ff'},
 {key:'Autres',label:'Autres statuts',color:'#94a3b8',soft:'#f8fafc'},
];
export const MONTHS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
export function inScope(date:string|null,scope:DashboardScope){if(scope.view==='global')return true;if(!date)return false;return date.slice(0,4)===String(scope.year)&&(scope.view==='year'||Number(date.slice(5,7))===scope.month);}
export function scopeLabel(scope:DashboardScope){return scope.view==='global'?'Toutes les périodes':scope.view==='year'?String(scope.year):`${MONTHS[scope.month-1]} ${scope.year}`;}
export function dashboardModel(contracts:Contract[],statements:Statement[],scope:DashboardScope,today:string){
 const cohort=contracts.filter(c=>inScope(c.registered_date,scope));
 const counts=STATUS_SERIES.map(s=>({...s,count:cohort.filter(c=>s.key==='Autres'?!STATUS_SERIES.slice(0,-1).some(k=>k.key===c.status_class):c.status_class===s.key).length}));
 const finance=contracts.filter(c=>c.status_class==='Effectif').map(c=>({contract:c,...retained(c,statements)})).filter(v=>inScope(v.period,scope));
 const gross=finance.reduce((n,v)=>n+v.gross_cents,0),centre=finance.reduce((n,v)=>n+v.centre_cents,0);
 const months=MONTHS.map((label,i)=>{const rows=contracts.filter(c=>c.registered_date?.slice(0,7)===`${scope.year}-${String(i+1).padStart(2,'0')}`);return {label,total:rows.length,counts:STATUS_SERIES.map(s=>({...s,count:rows.filter(c=>s.key==='Autres'?!STATUS_SERIES.slice(0,-1).some(k=>k.key===c.status_class):c.status_class===s.key).length}))};});
 return {cohort,counts,months,gross,centre,capella:gross-centre,commissioned:finance.length,clawback:finance.filter(v=>v.contract.clawback_end&&v.contract.clawback_end>today).length,confirmed:finance.filter(v=>v.confirmed).length,provisional:finance.filter(v=>!v.confirmed).length,undated:contracts.filter(c=>!c.registered_date).length,unassignedPeriod:contracts.filter(c=>c.status_class==='Effectif'&&!retained(c,statements).period).length,motifs:[...new Set(cohort.filter(c=>['Annulé','Résilié','Rejeté'].includes(c.status_class)).map(c=>c.status))].map(status=>({status,count:cohort.filter(c=>c.status===status).length})).sort((a,b)=>b.count-a.count)};
}
