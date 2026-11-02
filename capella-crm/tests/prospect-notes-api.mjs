import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const route=ts.transpileModule(fs.readFileSync('src/app/api/prospects/[id]/notes/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const prospect={id:'p1',notes:'Commentaire importé',created_at:'2026-01-01T00:00:00Z'};
const notes=[];
class Query {
 constructor(table){this.table=table;this.filters=[];this.op='read';}
 select(){return this} eq(k,v){this.filters.push([k,v]);return this} order(){return this} limit(){return this}
 insert(value){this.op='insert';this.value=value;return this} update(value){this.op='update';this.value=value;return this} delete(){this.op='delete';return this}
 run(){let rows=(this.table==='prospects'?[prospect]:notes).filter(r=>this.filters.every(([k,v])=>r[k]===v));
 if(this.op==='insert'){const row={id:'n'+(notes.length+1),created_at:new Date().toISOString(),...this.value};notes.push(row);rows=[row]}
 if(this.op==='update'){for(const row of rows)Object.assign(row,this.value)}
 if(this.op==='delete'){for(const row of rows){const i=notes.indexOf(row);if(i>=0)notes.splice(i,1)}}
 return {data:rows,error:null}}
 async maybeSingle(){const x=this.run();return {...x,data:x.data[0]||null}} async single(){return this.maybeSingle()}
 then(resolve,reject){return Promise.resolve(this.run()).then(resolve,reject)}
}
const db={from:table=>new Query(table)},profile={id:'u1',role:'commercial',full_name:'Commercial'};
const m={exports:{}};new Function('module','exports','require',route)(m,m.exports,name=>({
 'next/server':{NextResponse:{json:(data,opts)=>({data,status:opts?.status||200})}},
 '@/lib/auth':{requireProfile:async()=>profile},'@/lib/supabase/server':{createClient:async()=>db},
}[name]));
const params={params:Promise.resolve({id:'p1'})};
let result=await m.exports.GET(null,params);assert.equal(result.data.notes[0].body,'Commentaire importé');
result=await m.exports.POST({json:async()=>({body:'Nouvelle information'})},params);assert.equal(result.status,200);
assert.equal(prospect.notes,'Nouvelle information');assert.equal(notes.length,2);assert.equal(notes[0].body,'Commentaire importé');assert.equal(notes[1].body,'Nouvelle information');
result=await m.exports.GET(null,params);assert.equal(result.data.notes.length,2);
console.log('PASS: historique importé visible et conservé après ajout');
