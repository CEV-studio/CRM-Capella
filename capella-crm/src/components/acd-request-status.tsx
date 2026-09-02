"use client";
import { useState } from "react";

export function AcdRequestStatus({requestId,initial}:{requestId:string;initial:string}){
  const [value,setValue]=useState(initial);const [saving,setSaving]=useState(false);
  async function change(next:string){const previous=value;setValue(next);setSaving(true);const response=await fetch(`/api/acd/demandes/${requestId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status:next})});if(!response.ok)setValue(previous);setSaving(false)}
  return <select value={value} disabled={saving} onChange={e=>void change(e.target.value)} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-xs font-semibold text-navy-800"><option value="a_traiter">À traiter</option><option value="en_cours">En cours</option><option value="terminee">Terminée</option><option value="annulee">Annulée</option></select>
}
