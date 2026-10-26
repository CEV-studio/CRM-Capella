'use client';
import { useActionState } from 'react';
import { Button,Field,Input } from '@/components/ui';
import { creerProduit,activerProduit } from './actions';
import type { ActionResult } from '@/lib/action-result';
export function CreerProduitForm(){
 const [state,action,pending]=useActionState<ActionResult|null,FormData>(creerProduit,null);
 return <div className="p-5"><form action={action} className="grid gap-4 sm:grid-cols-2"><Field label="Nom du produit"><Input name="label" required maxLength={120}/></Field><Field label="Type"><select name="kind" defaultValue="other" className="h-10 rounded-lg border border-navy-200 px-3"><option value="energy">Énergie</option><option value="telecom">Télécom</option><option value="other">Autre</option></select></Field><Field label="Fournisseur"><Input name="supplier" maxLength={80}/></Field><Button type="submit" disabled={pending} className="self-end">{pending?'Ajout…':'Ajouter le produit'}</Button></form>{state&&<p role={state.ok?'status':'alert'} className="mt-3 text-sm">{state.message}</p>}</div>;
}
export function ActivationProduit({id,active}:{id:string;active:boolean}){
 const [state,action,pending]=useActionState<ActionResult|null,FormData>(activerProduit,null);
 return <form action={action}><input type="hidden" name="id" value={id}/><input type="hidden" name="active" value={String(!active)}/><Button type="submit" variant="ghost" disabled={pending}>{active?'Désactiver':'Activer'}</Button>{state&&<p role={state.ok?'status':'alert'} className="text-xs">{state.message}</p>}</form>;
}
