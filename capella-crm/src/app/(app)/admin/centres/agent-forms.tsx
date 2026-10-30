'use client';
import { useActionState } from 'react';
import { saveSalesAgent,toggleSalesAgent } from './agent-actions';
import type { ActionResult } from '@/lib/action-result';
import { Button,Field,Input } from '@/components/ui';

const field='h-10 rounded-lg border border-navy-200 px-3 text-sm';
export function AddSalesAgent({centres}:{centres:string[]}){
 const [state,action,pending]=useActionState<ActionResult|null,FormData>(saveSalesAgent,null);
 return <form action={action} className="grid gap-3 p-5 sm:grid-cols-4"><Field label="Centre"><select name="centre" required className={field}>{centres.map(c=><option key={c} value={c}>{c}</option>)}</select></Field><Field label="Identifiant reporting"><Input name="agent_ref" required maxLength={80} pattern="[a-zA-Z0-9._-]{2,80}" placeholder="khadijanouadi"/></Field><Field label="Nom affiché"><Input name="display_name" required maxLength={120} placeholder="Nom de l’agent"/></Field><Button disabled={pending} className="self-end">Ajouter l’agent</Button>{state&&<p role={state.ok?'status':'alert'} className="text-sm sm:col-span-4">{state.message}</p>}</form>;
}
export function SalesAgentRow({agent}:{agent:{id:string;centre:string;agent_ref:string;display_name:string;is_active:boolean}}){
 const [saved,save,pending]=useActionState<ActionResult|null,FormData>(saveSalesAgent,null);
 const [toggled,toggle,toggling]=useActionState<ActionResult|null,FormData>(toggleSalesAgent,null);
 return <div className="grid gap-3 border-t border-navy-100 p-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end"><span className="text-sm">{agent.centre}</span><span className="font-mono text-xs">{agent.agent_ref}</span><form action={save} className="flex gap-2"><input type="hidden" name="id" value={agent.id}/><input name="display_name" aria-label={`Nom affiché pour ${agent.agent_ref}`} defaultValue={agent.display_name} maxLength={120} required className={`min-w-0 flex-1 ${field}`}/><Button variant="ghost" disabled={pending}>Enregistrer</Button></form><form action={toggle}><input type="hidden" name="id" value={agent.id}/><Button name="active" value={String(!agent.is_active)} variant="ghost" disabled={toggling}>{agent.is_active?'Désactiver':'Réactiver'}</Button></form>{saved&&<p role={saved.ok?'status':'alert'} className="text-xs sm:col-span-4">{saved.message}</p>}{toggled&&<p role={toggled.ok?'status':'alert'} className="text-xs sm:col-span-4">{toggled.message}</p>}</div>;
}
