import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {NextRequest,NextResponse}=require('next/server');
function compile(path,mocks={}){const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const compiled={exports:{}};new Function('require','module','exports',js)(name=>name in mocks?mocks[name]:require(name),compiled,compiled.exports);return compiled.exports;}
const accountLabels=compile('src/lib/account-labels.ts');
const permissions=compile('src/lib/permissions.ts');const {canAccessPath,hasPermission}=permissions;
let profile,reads=0,rpcCalls=0,lastRpc;
const client={auth:{getClaims:async()=>({data:{claims:{sub:profile?.id}}}),signOut:async()=>{}},from(){return {select(){return this;},eq(){return this;},single:async()=>({data:profile}),maybeSingle:async()=>{reads++;return {data:profile};}};},rpc:async(name,args)=>{rpcCalls++;lastRpc={name,args};return {error:null};}};
const auth=compile('src/lib/auth.ts',{'server-only':{},react:{cache:f=>f},'next/navigation':{redirect:path=>{throw Error('redirect:'+path);}},'@/lib/supabase/server':{createClient:async()=>client},'@/lib/permissions':permissions,'@/lib/account-labels':accountLabels});
for(const [grants,adv,admin] of [[['adv'],true,false],[['administration'],true,true],[['crm'],false,false],[['apporteur'],false,false],[['adv','apporteur'],true,false],[['qualite','crm'],false,false],[[],false,false]]){
 profile={id:'test',permissions:grants,is_active:true};assert.equal(auth.estAdmin(profile),admin);assert.equal(auth.peutTraiterAdv(profile),adv);
 if(adv)await auth.requireAdv();else await assert.rejects(()=>auth.requireAdv(),/acces-refuse/);
 if(!admin)await assert.rejects(()=>auth.requireAdmin(),/acces-refuse/);
 profile.is_active=false;assert.equal(hasPermission(profile,grants[0]),false);await assert.rejects(()=>auth.requireAdv(),/compte-desactive/);
}
assert.equal(hasPermission({role:'admin',permissions:[],is_active:true},'administration'),false,'obsolete role cannot grant access');
const id='20000000-0000-4000-8000-000000000001';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-key';
const {default:proxy}=compile('src/proxy.ts',{'@supabase/ssr':{createServerClient:()=>client},'next/server':{NextResponse},'@/lib/permissions':permissions,'@/lib/account-labels':accountLabels});
async function visit(path,method='GET'){reads=0;const result=await proxy(new NextRequest('https://crm.capellaenergy.fr'+path,{method}));assert.equal(reads,1,'one permission profile read per request');return result;}
profile={id:'test',permissions:['adv','apporteur'],is_active:true};
for(const path of ['/adv','/admin/acd','/partenaires/portefeuille','/partenaires/opportunites/nouvelle','/partenaires/dossiers/'+id,'/pieces/'+id])assert.equal((await visit(path)).headers.get('x-middleware-next'),'1',path);
assert.equal((await visit('/api/acd/demandes/'+id,'PATCH')).headers.get('x-middleware-next'),'1');
for(const path of ['/admin/commerciaux','/email','/belgique','/prospection'])assert.equal(new URL((await visit(path)).headers.get('location')).pathname,'/adv',path);
assert.equal((await visit('/api/prospects/'+id+'/stage','POST')).status,403);
profile.permissions=['qualite','crm','email'];for(const path of ['/qualite','/prospection','/email'])assert.equal((await visit(path)).headers.get('x-middleware-next'),'1');
profile.permissions=['apporteur'];assert.equal((await visit('/api/acd/'+id)).status,403);assert.equal(canAccessPath(profile,'/adv'),false);
profile.permissions=['administration'];assert.equal((await visit('/admin/commerciaux')).headers.get('x-middleware-next'),'1');
profile.is_active=false;assert.equal((await visit('/api/acd/'+id)).status,403);assert.equal(new URL((await visit('/adv')).headers.get('location')).pathname,'/connexion');
// Exercise real account actions at the authenticated/service boundaries.
let lastPatch,createdInput,deleted=false,failUpdate=false,serviceCalls=0;
const service={auth:{admin:{async createUser(input){createdInput=input;return {data:{user:{id}},error:null};},async deleteUser(){deleted=true;return {error:null};}}},from(){serviceCalls++;return {eq(){return this;},update(patch){lastPatch=patch;return this;},then(resolve){return Promise.resolve({error:failUpdate?{message:'forced failure'}:null}).then(resolve);}};}};
const actions=compile('src/app/(app)/admin/commerciaux/actions.ts',{'next/cache':{revalidatePath:()=>{}},'@/lib/auth':auth,'@/lib/supabase/admin':{createAdminClient:()=>service},'@/lib/supabase/server':{createClient:async()=>client},'@/lib/permissions':permissions,'@/lib/account-labels':accountLabels});
function form(grants){const f=new FormData();for(const [k,v] of Object.entries({id,full_name:'Account test',email:'test@example.org',commission_rate:'50'}))f.set(k,v);for(const key of grants)f.append('permissions',key);return f;}
profile={id:'admin',permissions:['administration'],labels:[],is_active:true};
assert.equal((await actions.creerCommercial(null,form(['adv','apporteur']))).ok,true);assert.deepEqual(lastPatch.permissions,['adv','apporteur']);assert.equal(lastPatch.commission_rate,0.5);assert.deepEqual(lastPatch.labels,[]);assert.equal(createdInput.user_metadata.permissions,undefined);assert.equal(createdInput.user_metadata.role,undefined);
assert.equal((await actions.modifierPermissions(null,form(['qualite','crm']))).ok,true);assert.deepEqual(lastRpc,{name:'set_profile_permissions',args:{p_id:id,p_permissions:['qualite','crm']}});
const labelForm=form(['adv']);labelForm.set('labels','Qualité, Apporteur, qualité');
assert.equal((await actions.modifierEtiquettes(null,labelForm)).ok,true);
assert.deepEqual(lastRpc,{name:'set_profile_labels',args:{p_id:id,p_labels:['Qualité','Apporteur']}});
assert.deepEqual(profile.permissions,['administration'],'editing labels does not mutate permissions');
assert.throws(()=>accountLabels.readAccountLabels(new Map([['labels','x'.repeat(61)]])),/étiquettes/);
const before=serviceCalls;assert.equal((await actions.creerCommercial(null,form(['invalid']))).ok,false);assert.equal(serviceCalls,before);
failUpdate=true;assert.equal((await actions.creerCommercial(null,form(['adv']))).ok,false);assert.equal(deleted,true);
profile={id:'delegate',permissions:['crm','crm_gestion'],is_active:true};assert.equal((await actions.creerCommercial(null,form(['adv']))).ok,false);await assert.rejects(()=>actions.modifierPermissions(null,form(['administration'])),/acces-refuse/);
profile.permissions=['adv','apporteur'];await assert.rejects(()=>actions.creerCommercial(null,form(['administration'])),/acces-refuse/);assert.equal(rpcCalls,2);
console.log('PASS: labels independent from permissions, cumulative navigation/HTTP guards, inactive accounts, single profile lookup, account creation with trusted permissions, assignment and forbidden escalation');
