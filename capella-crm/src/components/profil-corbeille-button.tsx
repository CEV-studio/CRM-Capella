'use client';
import { useActionState } from 'react';
import { modifierCorbeilleProfil } from '@/app/(app)/admin/profils-supprimes/actions';
import type { ActionResult } from '@/lib/action-result';
import { Button } from '@/components/ui';

export function ProfilCorbeilleButton({id, nom, restaurer=false}:{id:string;nom:string;restaurer?:boolean}) {
 const [state,action,pending]=useActionState<ActionResult|null,FormData>(modifierCorbeilleProfil,null);
 return <div><form action={action} onSubmit={event=>{if(!window.confirm(restaurer?`Restaurer le profil de ${nom} ? Le compte restera désactivé.`:`Supprimer le profil de ${nom} ? Son compte sera désactivé et ses dossiers conservés.`))event.preventDefault();}}>
  <input type="hidden" name="id" value={id}/><input type="hidden" name="operation" value={restaurer?'restaurer':'supprimer'}/>
  <Button type="submit" variant="ghost" disabled={pending}>{pending?'…':restaurer?'Restaurer':'Supprimer le profil'}</Button>
 </form>{state&&<p role={state.ok?'status':'alert'} className="mt-2 text-sm">{state.message}</p>}</div>;
}
