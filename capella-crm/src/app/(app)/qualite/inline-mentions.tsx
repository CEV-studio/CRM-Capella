'use client';
import { useRef, useState } from 'react';

export type MentionPerson={id:string;full_name:string;role:string};
export function InlineMentions({people,value,onChange,mentionedIds,onMention}:{people:MentionPerson[];value:string;onChange:(value:string)=>void;mentionedIds:string[];onMention:(ids:string[])=>void}){
 const input=useRef<HTMLTextAreaElement>(null);
 const [cursor,setCursor]=useState(0);
 const [closed,setClosed]=useState(false);
 const before=value.slice(0,cursor);
 const match=before.match(/(^|\s)@([^@\n]*)$/u);
 const query=match?.[2].trim().toLocaleLowerCase('fr')||'';
 const suggestions=match&&!closed?people.filter(p=>p.full_name.toLocaleLowerCase('fr').includes(query)).slice(0,7):[];
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
