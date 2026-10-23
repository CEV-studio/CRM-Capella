import Link from 'next/link';
import { Card,CardHeader } from '@/components/ui';
import { euros,type Contract,type Statement,type CycleTracking,type SupplierBilling } from '@/lib/belgium/domain';
import { financialModel } from '@/lib/belgium/finance';
import { scopeLabel,type DashboardScope } from '@/lib/belgium/dashboard';
import { SupplierBillingForm } from './forms';
type Props={contracts:Contract[];statements:Statement[];tracking:CycleTracking[];billing:SupplierBilling[];scope:DashboardScope;today:string;centre:string};
export function FinancePanels(props:Props){
 const f=financialModel(props.contracts,props.statements,props.tracking,props.billing,props.scope,props.today);
 const label=scopeLabel(props.scope),hasReceipt=props.billing.some(b=>b.received_at&&b.received_cents>0);
 return <div className="space-y-6">
 <section className="rounded-3xl bg-gradient-to-br from-[#102840] to-[#234c64] p-6 text-white shadow-xl md:p-8">
 <p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-200">Énergie · {label} · {props.centre||'Tous les centres'}</p>
 <h2 className="mt-2 text-xl font-semibold">Production, facturation et encaissements</h2>
 
 <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
 {[{label:'Prévisionnel MEGA',value:euros(f.forecastGross),hint:'Production sans appel officiel reçu'},
 {label:'Validé par appel MEGA',value:euros(f.validatedGross),hint:'Montant officiel, facturé ou non'},
 {label:'Facturé à MEGA',value:euros(f.invoicedGross),hint:'Facturation explicitement confirmée'},
 {label:'Encaissements confirmés',value:props.centre?'Non ventilés':hasReceipt?euros(f.receivedGross):'Non renseignés',hint:props.centre?'Suivi global dans Facturation':'Aucun paiement supposé'}].map((tile,i)=><div className="rounded-2xl border border-white/10 bg-white/[.06] p-4" key={tile.label}><p className="text-xs text-slate-300">{tile.label}</p><p className={`mt-3 font-display text-2xl font-bold ${i===2?'text-orange-300':'text-white'}`}>{tile.value}</p></div>)}
 </div>
 <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-sm sm:grid-cols-3"><p>Part Capella prévisionnelle <strong className="mt-1 block text-xl text-orange-200">{euros(f.forecastCapella)}</strong></p><p>Part Capella validée <strong className="mt-1 block text-xl">{euros(f.validatedCapella)}</strong></p><p>Part Capella facturée <strong className="mt-1 block text-xl">{euros(f.invoicedCapella)}</strong></p></div>
 
 </section>
 <div className="grid gap-6 lg:grid-cols-2">
 <Card className="overflow-hidden"><div className="border-b border-orange-100 bg-orange-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-orange-700">Clawbacks · résiliations anticipées</p><div className="mt-3 flex items-end justify-between gap-4"><strong className="font-display text-4xl text-navy-800">{f.clawbacks.length}</strong></div></div><div className="space-y-3 p-5"><p className="flex justify-between gap-3 text-sm"><span>Reste à récupérer auprès des centres</span><strong>{euros(f.centreToRecover)}</strong></p><p className="flex justify-between gap-3 text-sm"><span>Reprise MEGA restant à rapprocher</span><strong>{euros(f.megaToRepay)}</strong></p><Link className="inline-block text-sm font-semibold text-star-600 underline" href="/belgique?tab=cycles">Ouvrir le suivi des cycles et reprises</Link></div></Card>
 <Card className="overflow-hidden"><div className="border-b border-emerald-100 bg-emerald-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Bonus de fidélité · 100 % Capella</p><p className="mt-3 font-display text-4xl font-bold text-navy-800">{euros(f.bonusDue)}</p></div><div className="space-y-3 p-5"><p className="flex justify-between text-sm"><span>Potentiels · non acquis</span><strong>{euros(f.bonusPotential)}</strong></p><p className="flex justify-between text-sm"><span>Facturés · en attente de paiement</span><strong>{euros(f.bonusInvoiced)}</strong></p><p className="flex justify-between text-sm"><span>Encaissés et confirmés</span><strong>{euros(f.bonusPaid)}</strong></p><Link className="inline-block text-sm font-semibold text-star-600 underline" href="/belgique?tab=cycles">Suivre les bonus par contrat</Link></div></Card>
 </div>
 </div>;
}
export function SupplierBillingPanel(props:Props){
 const f=financialModel(props.contracts,props.statements,props.tracking,props.billing,props.scope,props.today);
 return <Card><CardHeader title="Facturation fournisseur MEGA · tous centres" hint="L’appel officiel valide les montants. La transmission de facture et l’encaissement ont leurs propres confirmations."/><div className="divide-y divide-navy-100">{f.calendar.map(row=><section className="p-5" key={row.period}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-navy-800">Production {row.period.slice(0,7)} · appel prévu le {row.due.split('-').reverse().join('/')}</h3><p className="mt-1 text-sm text-grey-brand">{row.validated?`Appel officiel : ${euros(row.gross)} · ${row.invoiced?'Facturation confirmée':'Non facturé'}`:row.late?'Appel attendu, réception à vérifier':'Prévisionnel · appel à venir'} · {row.received>0?`Reçu : ${euros(row.received)}`:'Encaissement non renseigné'}</p></div></div><details><summary className="cursor-pointer text-sm font-semibold text-star-600">Mettre à jour le suivi de facturation</summary><div className="mt-4"><SupplierBillingForm period={row.period} value={row.state??undefined}/></div></details></section>)}{!f.calendar.length&&<p className="p-5 text-sm text-grey-brand">Aucune production sur cette période.</p>}</div></Card>;
}
