import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const mod={exports:{}};
new Function('module','exports','require',ts.transpileModule(fs.readFileSync('src/lib/belgium/centre-accounts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod,mod.exports,()=>({}));
const {provisionCentre}=mod.exports;
function mock(failure,agent=false){
 const calls=[];let banned=false,active=false,scoped=false,role='commercial',deleted=false;
 const state=()=>({banned,active,scoped,role,deleted});
 const db={auth:{admin:{
  async createUser(input){calls.push('create');assert.equal(input.email_confirm,true);assert.equal(input.ban_duration,'876000h');assert.equal(input.user_metadata.commission_rate,0);banned=true;return {data:{user:{id:'test'}},error:null};},
  async updateUserById(id,input){calls.push('unban');assert.equal(role,agent?'be_agent':'be_centre');assert.equal(scoped,true);assert.equal(active,true);assert.equal(input.ban_duration,'none');if(failure==='unban')return {error:{message:'failed'}};banned=false;return {error:null};},
  async deleteUser(){calls.push('delete');deleted=true;return {error:null};},
 }},from(table){let patch;const builder={
  update(input){patch=input;return builder;},eq(){return builder;},select(){return builder;},
  async single(){const step=patch.role?'profile':'activate';calls.push(step);if(failure===step)return {data:null,error:{message:'failed'}};if(patch.role){assert.equal(patch.commission_rate,0);for(const key of ['can_export','can_view_all','can_manage_team'])assert.equal(patch[key],false);assert.equal(patch.must_change_password,true);role=patch.role;}active=patch.is_active;return {data:{id:'test'},error:null};},
  async insert(input){calls.push('scope');assert.equal(table,'be_access');assert.equal(input.centre,'TILIRA');assert.equal(input.agent_ref,agent?'agent17':null);assert.equal(banned,true);if(failure==='scope')return {error:{message:'failed'}};scoped=true;return {error:null};},
  then(resolve){active=false;calls.push('disable');return Promise.resolve({error:null}).then(resolve);},
 };return builder;}};
 return {db,calls,state};
}
const input={name:'Centre',email:'centre@example.test',centre:'TILIRA',password:'a-test-password'};
const success=mock();assert.equal(await provisionCentre(success.db,input),'test');assert.deepEqual(success.calls,['create','profile','scope','activate','unban']);assert.deepEqual(success.state(),{banned:false,active:true,scoped:true,role:'be_centre',deleted:false});
for(const stage of ['profile','scope','activate','unban']){const failed=mock(stage);await assert.rejects(()=>provisionCentre(failed.db,input),/Création annulée/);assert.equal(failed.state().banned,true);assert.equal(failed.state().active,false);assert.equal(failed.state().deleted,true);assert.equal(failed.calls.at(-1),'delete');}
const agent=mock(undefined,true);await provisionCentre(agent.db,{...input,agentRef:'agent17'});assert.equal(agent.state().role,'be_agent');
const actions={exports:{}};let serviceCalls=0;
new Function('module','exports','require',ts.transpileModule(fs.readFileSync('src/app/(app)/admin/centres/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(actions,actions.exports,name=>{
 if(name==='@/lib/auth')return {requireAdmin:async()=>{throw Error('Not admin');}};
 if(name==='@/lib/supabase/admin')return {createAdminClient:()=>{serviceCalls++;throw Error('Must not be called');}};
 return {};
});
await assert.rejects(()=>actions.exports.creerCentre(null,new FormData()),/Not admin/);
await assert.rejects(()=>actions.exports.gererCentre(null,new FormData()),/Not admin/);
assert.equal(serviceCalls,0,'Non-admin requests are rejected before service-key access');
console.log('PASS: centre provisioning stays banned until fully scoped; zero financial privileges; failures disable and clean up without returning credentials.');
