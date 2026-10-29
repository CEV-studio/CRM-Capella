import Link from 'next/link';
import { cancellationStats } from '@/lib/belgium/cancellations';
import type { Contract,CycleTracking } from '@/lib/belgium/domain';

export function CancellationStats({contracts,tracking}:{contracts:Contract[];tracking:CycleTracking[]}){
 const stats=cancellationStats(contracts,tracking);
 const groups=[
  {title:'Annulés par le client avant activation',rows:stats.before,color:'#ea580c',background:'#fff7ed'},
  {title:'Résiliés après activation',rows:stats.after,color:'#7c3aed',background:'#f5f3ff'},
  {title:'Terminés avant 3 mois · confirmés',rows:stats.early,color:'#dc2626',background:'#fef2f2'},
  {title:'Délai de 3 mois à vérifier',rows:stats.pending,color:'#d97706',background:'#fffbeb'},
  {title:'Résiliés à partir de 3 mois',rows:stats.late,color:'#475569',background:'#f1f5f9'},
  {title:'Autres annulations · activation à vérifier',rows:stats.unknown,color:'#64748b',background:'#f8fafc'},
 ];
 return <section><h2 className="mb-4 font-display text-xl font-bold text-navy-800">Annulations & résiliations</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{groups.map(g=><details key={g.title} className="rounded-2xl border p-5 shadow-sm" style={{background:g.background,borderColor:g.color+'40'}}><summary className="cursor-pointer list-none"><p className="text-sm font-semibold" style={{color:g.color}}>{g.title}</p><p className="mt-3 font-display text-4xl font-bold text-navy-800">{g.rows.length}</p><p className="mt-2 text-xs text-grey-brand">Contrats / EAN · voir le détail</p></summary><ul className="mt-4 max-h-72 space-y-2 overflow-auto border-t border-navy-100 pt-3">{g.rows.map(c=><li key={c.key} className="text-sm"><Link className="font-medium text-navy-800 underline" href={'/belgique?'+new URLSearchParams({tab:'clients',q:c.mega_id})}>{c.client} · {c.energy}</Link><span className="block text-xs text-grey-brand">{c.mega_id} · {c.centre} · {c.status}</span></li>)}</ul></details>)}</div></section>;
}
