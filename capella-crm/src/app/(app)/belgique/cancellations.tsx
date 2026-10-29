import Link from 'next/link';
import { cancellationStats } from '@/lib/belgium/cancellations';
import type { Contract } from '@/lib/belgium/domain';

export function CancellationStats({contracts}:{contracts:Contract[]}){
 const stats=cancellationStats(contracts);
 const groups=[
  {title:'Annulés par le client',subtitle:'Avant versement de commission',rows:stats.cancelled,color:'#ea580c',background:'#fff7ed'},
  {title:'Terminés · Clawback',subtitle:'Commission versée · remboursement à traiter',rows:stats.terminated,color:'#dc2626',background:'#fef2f2'},
 ];
 return <section><h2 className="mb-4 font-display text-xl font-bold text-navy-800">Annulations client & clawback</h2><div className="grid gap-4 lg:grid-cols-2">{groups.map(g=><details open key={g.title} className="rounded-2xl border p-5 shadow-sm" style={{background:g.background,borderColor:g.color+'40'}}><summary className="cursor-pointer list-none"><p className="text-sm font-semibold" style={{color:g.color}}>{g.title}</p><p className="mt-1 text-xs text-grey-brand">{g.subtitle}</p><p className="mt-3 font-display text-4xl font-bold text-navy-800">{g.rows.length}</p><p className="mt-2 text-xs text-grey-brand">Contrats / EAN</p></summary><ul className="mt-4 max-h-72 space-y-2 overflow-auto border-t border-navy-100 pt-3">{g.rows.map(c=><li key={c.key} className="text-sm"><Link className="font-medium text-navy-800 underline" href={'/belgique?'+new URLSearchParams({tab:'clients',q:c.mega_id})}>{c.client} · {c.energy}</Link><span className="block text-xs text-grey-brand">{c.mega_id} · {c.centre} · {c.agent} · {c.status}</span></li>)}</ul></details>)}</div></section>;
}
