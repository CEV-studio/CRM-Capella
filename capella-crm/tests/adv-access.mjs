import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {NextRequest,NextResponse}=require('next/server');
function compile(path,mocks){
 const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const compiled={exports:{}};
 new Function('require','module','exports',source)(name=>name in mocks?mocks[name]:require(name),compiled,compiled.exports);
 return compiled.exports;
}
let profile;
const client={auth:{getClaims:async()=>({data:{claims:{sub:profile?.id}}}),signOut:async()=>{}},from(){return {select(){return this;},eq(){return this;},single:async()=>({data:profile}),maybeSingle:async()=>({data:profile})};}};
const redirect=path=>{throw new Error('redirect:'+path);};
const auth=compile('src/lib/auth.ts',{'server-only':{},react:{cache:f=>f},'next/navigation':{redirect},'@/lib/supabase/server':{createClient:async()=>client}});
for(const role of ['adv','admin','commercial','manager','apporteur','qualite']){
 profile={id:'test',role,is_active:true,can_manage_team:false,can_view_all:false};
 assert.equal(auth.peutTraiterAdv(profile),['adv','admin'].includes(role));
 if(['adv','admin'].includes(role)) assert.equal((await auth.requireAdv()).role,role);
 else await assert.rejects(()=>auth.requireAdv(),/acces-refuse/);
 if(role==='adv'){
  assert.equal(auth.estAdmin(profile),false);assert.equal(auth.peutGerer(profile),false);assert.equal(auth.voitTout(profile),false);
  await assert.rejects(()=>auth.requireAdmin(),/acces-refuse/);await assert.rejects(()=>auth.requireManage(),/acces-refuse/);
 }
 profile.is_active=false;assert.equal(auth.peutTraiterAdv(profile),false);
 await assert.rejects(()=>auth.requireAdv(),/compte-desactive/);
}
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-key';
const {default:proxy}=compile('src/proxy.ts',{'@supabase/ssr':{createServerClient:()=>client},'next/server':{NextResponse}});
const id='20000000-0000-4000-8000-000000000001';
const invoke=(path,method='GET')=>proxy(new NextRequest('https://crm.capellaenergy.fr'+path,{method}));
profile={id:'test',role:'adv',is_active:true};
for(const [path,method] of [['/adv','GET'],['/adv','POST'],['/admin/acd','GET'],['/api/acd/demandes/'+id,'PATCH'],['/api/acd/'+id,'GET'],['/api/acd/'+id+'/telecharger','GET'],['/pieces/'+id,'GET'],['/partenaires/dossiers/'+id,'GET'],['/api/partenaires/commandes','POST'],['/api/notifications/lire','POST'],['/conversion/'+id,'GET']]) assert.equal((await invoke(path,method)).headers.get('x-middleware-next'),'1',path);
for(const path of ['/admin/commerciaux','/admin/export','/comptabilite/belgique','/belgique','/email','/admin/reservoir','/partenaires/opportunites/nouvelle']) assert.equal(new URL((await invoke(path)).headers.get('location')).pathname,'/adv',path);
for(const [path,method] of [['/api/belgique/export','GET'],['/api/prospects/'+id+'/stage','POST'],['/api/acd/'+id+'/demander','POST'],['/admin/commerciaux','POST']]) assert.equal((await invoke(path,method)).status,403,path);
profile.is_active=false;assert.equal((await invoke('/api/acd/'+id)).status,403);assert.equal(new URL((await invoke('/adv')).headers.get('location')).pathname,'/connexion');
profile={id:'test',role:'commercial',is_active:true};assert.equal((await invoke('/api/acd/'+id)).status,403);
profile.role='admin';assert.equal((await invoke('/admin/commerciaux')).headers.get('x-middleware-next'),'1');assert.equal((await invoke('/api/acd/'+id)).headers.get('x-middleware-next'),'1');
console.log('PASS: server authorization and HTTP proxy matrix for ADV/admin/commercial and inactive accounts');
// Exercise the real account actions with the service client boundary mocked.
let accountRole='commercial',lastPatch,createdInput,deleted=false,failRole=false,serviceCalls=0;
const service={auth:{admin:{async createUser(input){createdInput=input;return {data:{user:{id}},error:null};},async deleteUser(){deleted=true;return {error:null};}}},from(){serviceCalls++;let updating=false;return {select(){return this;},is(){return this;},eq(){return this;},update(patch){lastPatch=patch;updating=true;return this;},async maybeSingle(){if(updating){accountRole=lastPatch.role;return {data:{id},error:null};}return {data:{role:accountRole},error:null};},then(resolve){return Promise.resolve({error:failRole?{message:'forced role failure'}:null}).then(resolve);}};}};
const actions=compile('src/app/(app)/admin/commerciaux/actions.ts',{'next/cache':{revalidatePath:()=>{}},'@/lib/auth':auth,'@/lib/supabase/admin':{createAdminClient:()=>service}});
function accountForm(role){const f=new FormData();for(const [k,v] of Object.entries({id,role,full_name:'ADV test',email:'adv@example.org',commission_rate:'50'}))f.set(k,v);return f;}
profile={id:'admin',role:'admin',is_active:true};
assert.equal((await actions.creerCommercial(null,accountForm('adv'))).ok,true);
assert.equal(createdInput.user_metadata.role,'commercial','signup metadata cannot grant privilege');assert.equal(createdInput.user_metadata.commission_rate,0);
assert.equal(lastPatch.role,'adv');for(const key of ['can_manage_team','can_export','can_view_all'])assert.equal(lastPatch[key],false);
assert.equal((await actions.modifierRole(null,accountForm('adv'))).ok,true);assert.equal(lastPatch.commission_rate,0);assert.equal(lastPatch.manager_id,null);assert.equal(lastPatch.partner_team_id,null);
failRole=true;assert.equal((await actions.creerCommercial(null,accountForm('adv'))).ok,false);assert.equal(deleted,true,'failed provisioning cleans up');
const beforeServiceCalls=serviceCalls;
profile={id:'delegated',role:'commercial',is_active:true,can_manage_team:true};assert.equal((await actions.creerCommercial(null,accountForm('adv'))).ok,false);assert.equal((await actions.modifierRole(null,accountForm('adv'))).ok,false);assert.equal(serviceCalls,beforeServiceCalls);
profile={id:'adv',role:'adv',is_active:true};await assert.rejects(()=>actions.creerCommercial(null,accountForm('adv')),/acces-refuse/);assert.equal(serviceCalls,beforeServiceCalls);
console.log('PASS: admin creates/assigns ADV with zero general privileges; failed provisioning cleans up; delegated commercial and ADV cannot grant role');
