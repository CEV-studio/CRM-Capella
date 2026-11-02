import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('src/proxy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let role='admin',calls=0,authenticated=true;
const client={auth:{getClaims:async()=>({data:{claims:authenticated?{sub:'test-user'}:null}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{calls++;return {data:{role,is_active:true}}}})})})};
class Response { constructor(body,options={}){this.body=body;this.status=options.status||200} }
const NextResponse=Object.assign(Response,{next:()=>({status:200,cookies:{set(){}}}),redirect:url=>({status:307,url}),json:(body,options)=>({body,status:options.status})});
const mod={exports:{}};new Function('module','exports','require',source)(mod,mod.exports,name=>({'@supabase/ssr':{createServerClient:()=>client},'next/server':{NextResponse}}[name]));
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test';
async function visit(path,method='GET') {calls=0;const u=new URL('https://crm.example.test'+path);u.clone=()=>new URL(u);const result=await mod.exports.default({method,nextUrl:u,cookies:{getAll:()=>[]},headers:new Headers()});return {result,calls}}
for(const r of ['admin','commercial']){role=r;const t=await visit('/prospection');assert.equal(t.result.status,200);assert.equal(t.calls,1)}
role='apporteur';let t=await visit('/prospection');assert.equal(t.result.status,307);assert.equal(t.result.url.pathname,'/partenaires/opportunites');assert.equal(t.calls,1);
role='qualite';t=await visit('/prospection');assert.equal(t.result.url.pathname,'/qualite');assert.equal(t.calls,1);t=await visit('/qualite');assert.equal(t.result.status,200);assert.equal(t.calls,1);
role='be_agent';t=await visit('/belgique/encoder');assert.equal(t.result.status,200);assert.equal(t.calls,1);t=await visit('/api/qualite');assert.equal(t.result.status,403);assert.equal(t.calls,1);
role='commercial';t=await visit('/api/acd/example');assert.equal(t.result.status,403);assert.equal(t.calls,1);role='admin';t=await visit('/api/acd/example');assert.equal(t.result.status,200);assert.equal(t.calls,1);
authenticated=false;t=await visit('/prospection');assert.equal(t.result.status,307);assert.equal(t.calls,0);
console.log('PASS: navigation and protected routes use one role query; role restrictions preserved.');
