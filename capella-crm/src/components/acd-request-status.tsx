"use client";
import { useState } from "react";
import {useRouter} from 'next/navigation';
export function AcdRequestStatus({requestId,initial}:{requestId:string;initial:string}){
 const router=useRouter();const [value,setValue]=useState(initial),[saving,setSaving]=useState(false),[error,setError]=useState('');
 async function change(next:string){const previous=value;setValue(next);setSaving(true);setError('');try{const response=await fetch(`/api/acd/demandes/${requestId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status:next})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Mise à jour impossible');router.refresh();}catch(e){setValue(previous);setError((e as Error).message);}finally{setSaving(false);}}
 return <div><select aria-label="Statut de la demande ACD" value={value} disabled={saving} onChange={e=>void change(e.target.value)} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-xs font-semibold text-navy-800"><option value="a_traiter">À traiter</option><option value="en_cours">En cours</option><option value="envoyee">Envoyée — en attente de signature</option><option value="terminee">Terminée — ACD signée</option><option value="annulee">Annulée</option></select>{error?<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>:null}</div>;
}
