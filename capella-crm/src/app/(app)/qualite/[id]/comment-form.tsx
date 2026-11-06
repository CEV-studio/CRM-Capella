'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InlineMentions,type MentionPerson } from '../inline-mentions';

export function QualityReviewCommentForm({reviewId,people}:{reviewId:string;people:MentionPerson[]}){
 const router=useRouter();const [body,setBody]=useState('');const [mentionedIds,setMentionedIds]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError('');
  try{
   const active=mentionedIds.filter(id=>{const person=people.find(p=>p.id===id);return person&&body.includes(`@${person.full_name}`);});
   const response=await fetch(`/api/qualite/${reviewId}/commentaires`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body,mentioned_ids:active})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Ajout impossible.');
   setBody('');setMentionedIds([]);router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Ajout impossible.');}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="space-y-3"><InlineMentions people={people} value={body} onChange={setBody} mentionedIds={mentionedIds} onMention={setMentionedIds} label="Ajouter un commentaire" placeholder="Répondez ici. Utilisez @ pour notifier un collègue." maxLength={5000}/>{error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}<button disabled={busy||!body.trim()} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy?'Envoi…':'Publier le commentaire'}</button></form>;
}
