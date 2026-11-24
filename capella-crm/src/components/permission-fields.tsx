import {PERMISSIONS,type Permission} from '@/lib/permissions';
const GROUPS:{title:string;keys:readonly Permission[]}[]=[
 {title:'Features et espaces',keys:['crm','apporteur','adv','qualite','equipe','belgique_lecture','belgique_centre','belgique_encodage','email']},
 {title:'Actions et périmètres',keys:['crm_gestion','crm_lecture_globale','export']},
 {title:'Administration',keys:['administration']},
];
export function PermissionFields({selected=[],disabled=false}:{selected?:readonly string[];disabled?:boolean}){
 return <div className="space-y-4">{GROUPS.map(group=><fieldset key={group.title} disabled={disabled} className="grid gap-2 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold">{group.title}</legend>{group.keys.map(key=>{const permission=PERMISSIONS.find(p=>p.key===key)!;return <label key={key} className="flex items-center gap-2 rounded-lg border border-navy-100 bg-white p-3 text-sm"><input type="checkbox" name="permissions" value={key} defaultChecked={selected.includes(key)}/>{permission.label}</label>;})}</fieldset>)}</div>;
}
