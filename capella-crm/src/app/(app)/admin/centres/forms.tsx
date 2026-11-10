'use client';
import { useActionState,useState } from 'react';
import { creerCentre,gererCentre,ajouterCentre,supprimerCentre } from './actions';
import type { ActionResult } from '@/lib/action-result';
import { Button,Field,Input } from '@/components/ui';

function Result({state}:{state:ActionResult|null}){
 if(!state)return null;
 return <div role={state.ok?'status':'alert'} className={`mt-4 rounded-xl border p-4 text-sm ${state.ok?'border-emerald-200 bg-emerald-50 text-emerald-950':'border-rose-200 bg-rose-50 text-rose-950'}`}><p>{state.message}</p>{state.ok&&state.motDePasse&&<div className="mt-3 flex flex-wrap items-center gap-3"><span>Mot de passe provisoire</span><code className="select-all break-all rounded bg-white px-3 py-2 font-semibold">{state.motDePasse}</code><Button type="button" variant="ghost" onClick={()=>navigator.clipboard.writeText(state.motDePasse!)}>Copier</Button></div>}</div>;
}
export function CreerCentreForm({centres,centre,agentRef,agentName}:{centres:string[];centre?:string;agentRef?:string;agentName?:string}){
 const [state,action,pending]=useActionState<ActionResult|null,FormData>(creerCentre,null);
 const [kind,setKind]=useState(agentRef?'agent':'centre');
 return <div className="p-5"><form action={action} className="grid gap-4 sm:grid-cols-2"><Field label="Type de compte"><select name="kind" value={kind} onChange={e=>setKind(e.target.value)} className="h-10 rounded-lg border border-navy-200 px-3"><option value="centre">Responsable centre</option><option value="agent">Agent — encodage des ventes</option></select></Field>{kind==='agent'&&<Field label="Identifiant agent MEGA"><Input name="agent_ref" defaultValue={agentRef} required maxLength={80} placeholder="khadijanouadi" pattern="[a-zA-Z0-9._-]{2,80}"/></Field>}<Field label="Centre"><Input name="centre" defaultValue={centre} readOnly={!!centre} list="centres-existants" required maxLength={100} placeholder="TILIRA, Cimsourse ou nouveau centre"/><datalist id="centres-existants">{centres.map(c=><option value={c} key={c}/>)}</datalist></Field><Field label="Nom du compte"><Input name="full_name" defaultValue={agentName} required maxLength={120} placeholder="Responsable du centre"/></Field><Field label="Email de connexion"><Input name="email" type="email" required maxLength={254} autoComplete="off"/></Field><Button type="submit" disabled={pending} className="self-end">{pending?'Création…':'Créer le compte'}</Button></form><Result state={state}/></div>;
}
export function GestionCentre({id,active}:{id:string;active:boolean}){
 const [state,action,pending]=useActionState<ActionResult|null,FormData>(gererCentre,null);
 return <div><form action={action} className="mt-3 flex flex-wrap gap-3"><input type="hidden" name="id" value={id}/><Button name="operation" value={active?'desactiver':'activer'} variant="ghost" disabled={pending}>{active?'Désactiver':'Activer'}</Button><Button name="operation" value="password" variant="ghost" disabled={pending}>Réinitialiser le mot de passe</Button></form><Result state={state}/></div>;
}

export function NouveauCentre(){
 const [state,action,pending]=useActionState<ActionResult|null,FormData>(ajouterCentre,null);
 return <form action={action} className="flex flex-wrap items-end gap-3 p-5"><Field label="Nom du centre"><Input name="name" required maxLength={100}/></Field><Button disabled={pending}>Créer le centre</Button><Result state={state}/></form>;
}

export function SupprimerCentre({centre}:{centre:string}){
 const [state,action,pending]=useActionState<ActionResult|null,FormData>(supprimerCentre,null);
 return <form action={action} onSubmit={e=>{if(!window.confirm(`Supprimer ${centre} ? Les accès du centre seront désactivés. Les ventes et contrôles seront conservés.`))e.preventDefault();}}><input type="hidden" name="centre" value={centre}/><Button variant="ghost" disabled={pending}>Supprimer le centre</Button><Result state={state}/></form>;
}
