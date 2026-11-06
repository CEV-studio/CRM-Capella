'use client';
import { useRef, useState } from 'react';

export type MentionPerson={id:string;full_name:string;role:string};
const normalize=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
function matchesName(name:string,query:string){
 if(name.includes(query))return true;
 // Tolère une lettre omise dans un prénom (ex. Thibaut → Thibault).
 if(query.length<4)return false;
 return name.split(/\s+/).some(part=>part.length===query.length+1&&[...part].some((_,i)=>part.slice(0,i)+part.slice(i+1)===query));
}
export function InlineMentions({people,value,onChange,mentionedIds,onMention}:{people:MentionPerson[];value:string;onChange:(value:string)=>void;mentionedIds:string[];onMention:(ids:string[])=>void}){
 const input=useRef<HTMLTextAreaElement>(null);
 const [cursor,setCursor]=useState(0);
 const [closed,setClosed]=useState(false);
 const before=value.slice(0,cursor);
 const match=before.match(/(^|\s)@([^@\n]*)$/u);
 const query=normalize(match?.[2].trim()||'');
 const suggestions=match&&!closed?people.filter(p=>matchesName(normalize(p.full_name),query)).sort((a,b)=>Number(b.role==='qualite')-Number(a.role==='qualite')||a.full_name.localeCompare(b.full_name,'fr')).slice(0,7):[];
 function choose(person:MentionPerson){
  if(!match)return;
  const start=cursor-match[0].length+match[1].length;
  const token=`@${person.full_name}`;
  const next=value.slice(0,start)+token+' '+value.slice(cursor);
  onChange(next);
  onMention([...new Set([...mentionedIds,person.id])]);
  setClosed(true);
  const position=start+token.length+1;
  setCursor(position);
  requestAnimationFrame(()=>{input.current?.focus();input.current?.setSelectionRange(position,position);});
 }
 return <div className="relative"><label className="block text-sm font-medium">Synthèse du contrôle (facultatif)
  <textarea ref={input} className="mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm" rows={4} maxLength={10000} value={value} placeholder="Résumez l’écoute et écrivez @ pour notifier un collègue" onChange={e=>{onChange(e.target.value);setCursor(e.target.selectionStart);setClosed(false);}} onClick={e=>{setCursor(e.currentTarget.selectionStart);setClosed(false);}} onKeyUp={e=>setCursor(e.currentTarget.selectionStart)} onKeyDown={e=>{if(e.key==='Escape')setClosed(true);if(e.key==='Enter'&&suggestions.length){e.preventDefault();choose(suggestions[0]);}}}/>
 </label>{suggestions.length>0&&<div className="absolute z-20 max-h-48 w-full overflow-y-auto rounded-lg border border-navy-200 bg-white shadow-lg" role="listbox" aria-label="Personnes à mentionner">{suggestions.map(p=><button type="button" role="option" aria-selected="false" key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-sky-50" onMouseDown={e=>e.preventDefault()} onClick={()=>choose(p)}>@{p.full_name} <span className="text-grey-brand">· {p.role}</span></button>)}</div>}</div>;
}
