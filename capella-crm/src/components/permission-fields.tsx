import { PERMISSIONS } from '@/lib/permissions';
export function PermissionFields({selected=[],disabled=false}:{selected?:readonly string[];disabled?:boolean}){
 return <fieldset disabled={disabled} className="grid gap-2 sm:grid-cols-2"><legend className="mb-3 text-sm font-semibold">Permissions cumulables</legend>{PERMISSIONS.map(p=><label key={p.key} className="flex items-center gap-2 rounded-lg border border-navy-100 bg-white p-3 text-sm"><input type="checkbox" name="permissions" value={p.key} defaultChecked={selected.includes(p.key)}/>{p.label}</label>)}</fieldset>;
}
