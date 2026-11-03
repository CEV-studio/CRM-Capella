'use client';
import { useActionState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import type { ActionResult } from '@/lib/action-result';
import type { PartnerTeam } from '@/lib/domain/database.types';
import { enregistrerEquipe } from './actions';

export function EquipeForm({team,managers}:{team?:PartnerTeam;managers:{id:string;full_name:string}[]}){
 const [state,action,busy]=useActionState<ActionResult|null,FormData>(enregistrerEquipe,null);
 return <form action={action} className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
  {team&&<input type="hidden" name="id" value={team.id}/>}
  <Field label="Nom de l’équipe"><Input name="name" defaultValue={team?.name} maxLength={120} required/></Field>
  <Field label="Partenaire"><Input name="partner_name" defaultValue={team?.partner_name??''} maxLength={120}/></Field>
  <Field label="Manager"><select name="manager_id" defaultValue={team?.manager_id??''} className="h-10 w-full rounded-lg border border-navy-200 px-3"><option value="">Aucun</option>{managers.map(m=><option value={m.id} key={m.id}>{m.full_name}</option>)}</select></Field>
  <Button disabled={busy} type="submit">{busy?'Enregistrement…':team?'Enregistrer':'Créer l’équipe'}</Button>
  {state&&<p role={state.ok?'status':'alert'} className="sm:col-span-2 lg:col-span-4 text-sm">{state.message}</p>}
 </form>;
}
