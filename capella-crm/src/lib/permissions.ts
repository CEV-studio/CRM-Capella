export const PERMISSIONS = [
 {key:'crm',label:'CRM commercial'},
 {key:'apporteur',label:'Apporteur d’affaires'},
 {key:'adv',label:'Traitement ADV et ACD'},
 {key:'qualite',label:'Contrôle qualité'},
 {key:'equipe',label:'Suivi de mes équipes'},
 {key:'belgique_lecture',label:'Production Belgique — lecture globale'},
 {key:'belgique_centre',label:'Belgique — gestion de mon centre'},
 {key:'belgique_encodage',label:'Belgique — encodage de mes ventes'},
 {key:'email',label:'Messagerie'},
 {key:'crm_gestion',label:'Gestion et distribution des dossiers CRM'},
 {key:'crm_lecture_globale',label:'Lecture de tous les dossiers CRM'},
 {key:'export',label:'Export des données autorisées'},
 {key:'administration',label:'Administration complète du CRM'},
] as const;
export type Permission = typeof PERMISSIONS[number]['key'];
export type PermissionProfile = {permissions?:readonly string[];is_active?:boolean};
export function hasPermission(profile:PermissionProfile|null|undefined,permission:Permission):boolean{
 return !!profile && profile.is_active!==false && (profile.permissions??[]).includes(permission);
}
export function hasAnyPermission(profile:PermissionProfile|null|undefined,permissions:readonly Permission[]):boolean{
 return permissions.some(permission=>hasPermission(profile,permission));
}
export function permissionLabels(profile:PermissionProfile):string{
 return PERMISSIONS.filter(p=>hasPermission(profile,p.key)).map(p=>p.label).join(' · ')||'Aucun accès';
}
export function readPermissions(form:FormData):Permission[]{
 const raw=form.getAll('permissions').map(String);
 if(raw.some(value=>!PERMISSIONS.some(p=>p.key===value)))throw new Error('Permission inconnue.');
 return [...new Set(raw)] as Permission[];
}
export function homePath(profile:PermissionProfile):string{
 if(hasPermission(profile,'administration')||hasPermission(profile,'crm'))return '/';
 if(hasPermission(profile,'adv'))return '/adv';
 if(hasPermission(profile,'qualite'))return '/qualite';
 if(hasPermission(profile,'apporteur'))return '/partenaires/portefeuille';
 if(hasPermission(profile,'equipe'))return '/equipe';
 if(hasAnyPermission(profile,['belgique_lecture','belgique_centre','belgique_encodage']))return '/belgique';
 return '/notifications';
}
/** Route checks are additive. Row ownership and operation checks remain in SQL. */
export function canAccessPath(profile:PermissionProfile,path:string,method='GET'):boolean{
 if(profile.is_active===false)return false;
 if(hasPermission(profile,'administration'))return true;
 if(path==='/'||['/notifications','/api/notifications/lire','/api/partenaires/notifications','/changer-mot-de-passe','/deconnexion'].includes(path))return true;
 const match=(prefix:string)=>path===prefix||path.startsWith(prefix+'/');
 if(match('/admin/acd')||match('/adv')||/^\/api\/acd\/demandes\//.test(path))return hasPermission(profile,'adv');
 if(match('/admin/export'))return hasPermission(profile,'export');
 if(['/admin/commerciaux','/admin/reservoir','/admin/corbeille'].some(match))return hasPermission(profile,'crm_gestion');
 if(match('/admin')||match('/comptabilite'))return false;
 if(match('/partenaires')||match('/api/partenaires'))return hasAnyPermission(profile,['apporteur','adv']);
 if(match('/pieces'))return hasAnyPermission(profile,['crm','apporteur','adv']);
 if(match('/api/acd'))return path.endsWith('/demander')?hasPermission(profile,'crm'):hasPermission(profile,'adv');
 if(match('/qualite')||match('/api/qualite'))return hasPermission(profile,'qualite')||/^\/qualite\/[0-9a-f-]{36}$/i.test(path)||/^\/qualite\/signalements\/[0-9a-f-]{36}$/i.test(path)||/^\/api\/qualite\/(?:signalements\/)?[0-9a-f-]{36}\/commentaires$/i.test(path)&&method==='POST';
 if(match('/belgique')||match('/api/belgique'))return path.includes('/encoder')?hasAnyPermission(profile,['belgique_centre','belgique_encodage']):hasAnyPermission(profile,['qualite','belgique_lecture','belgique_centre','belgique_encodage']);
 if(match('/equipe'))return hasPermission(profile,'equipe');
 if(match('/email')||match('/api/gmail')||match('/popup/email'))return hasPermission(profile,'email');
 if(['/prospection','/clients','/mes-clients','/conversion','/commissions','/journee','/echeances','/agenda','/api/prospects','/popup/prospect','/popup/comparatif','/popup/resiliation'].some(match)){
  if(hasPermission(profile,'crm'))return true;
  return hasPermission(profile,'adv')&&/^\/(?:conversion|prospection|popup\/prospect)\/[0-9a-f-]{36}$/i.test(path)&&(method==='GET'||method==='POST');
 }
 return false;
}
