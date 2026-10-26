import { classify,statusLabel } from '@/lib/belgium/domain';
export const tones={
 emerald:{badge:'border-emerald-200 bg-emerald-100 text-emerald-900',panel:'border-emerald-200 bg-emerald-50',edge:'border-l-emerald-500'},
 sky:{badge:'border-sky-200 bg-sky-100 text-sky-900',panel:'border-sky-200 bg-sky-50',edge:'border-l-sky-500'},
 amber:{badge:'border-amber-200 bg-amber-100 text-amber-900',panel:'border-amber-200 bg-amber-50',edge:'border-l-amber-500'},
 violet:{badge:'border-violet-200 bg-violet-100 text-violet-900',panel:'border-violet-200 bg-violet-50',edge:'border-l-violet-500'},
 rose:{badge:'border-rose-200 bg-rose-100 text-rose-900',panel:'border-rose-200 bg-rose-50',edge:'border-l-rose-500'},
 orange:{badge:'border-orange-200 bg-orange-100 text-orange-900',panel:'border-orange-200 bg-orange-50',edge:'border-l-orange-500'},
 indigo:{badge:'border-indigo-200 bg-indigo-100 text-indigo-900',panel:'border-indigo-200 bg-indigo-50',edge:'border-l-indigo-500'},
 slate:{badge:'border-slate-200 bg-slate-100 text-slate-700',panel:'border-slate-200 bg-slate-50',edge:'border-l-slate-400'},
};
export type Tone=keyof typeof tones;
export function statusTone(value:string):Tone{
 if(!value.trim()||value==='—')return 'slate';
 if(value.toLowerCase().includes('abandonn'))return 'rose';
 if(value.toLowerCase().includes('erreur'))return 'orange';
 const known:Record<string,Tone>={'Signé':'emerald','Effectif':'emerald','En attente':'amber','Salle d’attente':'sky','Résilié':'violet','Annulé':'rose','Rejeté':'rose','Incomplet':'slate','En cours':'indigo'};
 return known[value]||known[classify(value)]||'slate';
}
export function ColorBadge({label,tone='slate'}:{label:string;tone?:Tone}){
 return <span className={`inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold leading-5 ${tones[tone].badge}`}><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"/>{label}</span>;
}
export function StatusBadge({value}:{value:string}){return <ColorBadge label={statusLabel(value)} tone={statusTone(value)}/>;}
