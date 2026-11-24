"use client";
import {ProfilCorbeilleButton} from '@/components/profil-corbeille-button';
import {useActionState} from 'react';
import type {Profile} from '@/lib/domain/database.types';
import type {ActionResult} from '@/lib/action-result';
import {PermissionFields} from '@/components/permission-fields';
import {permissionLabels,hasPermission} from '@/lib/permissions';
import {modifierEtiquettes,modifierPermissions,modifierTaux,basculerActivation,reinitialiserMotDePasse,affecterEquipe} from './actions';
export function LigneCommercial({profil,estMoi,estAdmin,equipes=[]}:{profil:Profile;estMoi:boolean;estAdmin:boolean;equipes?:{id:string;name:string}[]}){
 const [labelState,labelAction,labelPending]=useActionState<ActionResult|null,FormData>(modifierEtiquettes,null);
 const [permissionState,permissionAction,pending]=useActionState<ActionResult|null,FormData>(modifierPermissions,null);
 const [rateState,rateAction]=useActionState<ActionResult|null,FormData>(modifierTaux,null);
 const [activeState,activeAction]=useActionState<ActionResult|null,FormData>(basculerActivation,null);
 const [passwordState,passwordAction]=useActionState<ActionResult|null,FormData>(reinitialiserMotDePasse,null);
 const [teamState,teamAction]=useActionState<ActionResult|null,FormData>(affecterEquipe,null);
 const message=permissionState??rateState??activeState??passwordState??teamState;
 return <li className="border-b border-navy-100"><details><summary className="cursor-pointer space-y-1 px-5 py-4"><span className="font-semibold">{profil.full_name}{estMoi?' (vous)':''}</span><span className="ml-3 text-xs">{profil.is_active?'Actif':'Désactivé'}</span><p className="text-xs text-grey-brand">{profil.email}</p><div className="flex flex-wrap gap-1">{(profil.labels??[]).map(label=><span key={label} className="rounded-full border border-navy-200 bg-white px-2 py-0.5 text-xs">{label}</span>)}</div><p className="text-xs text-navy-600">{permissionLabels({...profil,is_active:true})}</p></summary><div className="space-y-5 bg-navy-50/50 p-5">
 {estAdmin?<><form action={labelAction} className="space-y-2"><input type="hidden" name="id" value={profil.id}/><label className="block text-sm font-semibold">Étiquettes (sans droits)<input name="labels" defaultValue={(profil.labels??[]).join(', ')} maxLength={800} placeholder="Qualité, Apporteur…" className="mt-1 block w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"/></label><button disabled={labelPending} className="text-sm underline">Enregistrer les étiquettes</button>{labelState?<p role="status" className="text-sm">{labelState.message}</p>:null}</form><form action={permissionAction} className="space-y-3"><input type="hidden" name="id" value={profil.id}/><PermissionFields selected={profil.permissions}/><button disabled={pending} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">{pending?'Enregistrement…':'Enregistrer les permissions'}</button></form>
 <form action={rateAction} className="flex items-center gap-2"><input type="hidden" name="id" value={profil.id}/><label className="text-sm">Commission personnelle (%) <input className="w-20 rounded border p-2" name="commission_rate" type="number" min="0" max="100" defaultValue={profil.commission_rate*100}/></label><button className="text-sm underline">Enregistrer</button></form>
 {hasPermission({...profil,is_active:true},'crm')?<form action={teamAction} className="flex gap-2"><input type="hidden" name="id" value={profil.id}/><select name="partner_team_id" defaultValue={profil.partner_team_id??''}><option value="">Aucune équipe</option>{equipes.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><button className="text-sm underline">Attribuer l’équipe</button></form>:null}
 <div className="flex flex-wrap gap-4"><form action={passwordAction}><input type="hidden" name="id" value={profil.id}/><button className="text-sm underline">Réinitialiser le mot de passe</button></form>{!estMoi?<form action={activeAction}><input type="hidden" name="id" value={profil.id}/><input type="hidden" name="actif" value={String(!profil.is_active)}/><button className="text-sm underline">{profil.is_active?'Désactiver':'Réactiver'}</button></form>:null}{!estMoi&&!hasPermission({...profil,is_active:true},'administration')?<ProfilCorbeilleButton id={profil.id} nom={profil.full_name}/>:null}</div></>:null}
 {message?<p className="text-sm" role="status">{message.message}</p>:null}{passwordState?.ok&&passwordState.motDePasse?<code>{passwordState.motDePasse}</code>:null}
 </div></details></li>;
}
