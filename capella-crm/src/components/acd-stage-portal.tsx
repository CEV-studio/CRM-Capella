"use client";

import { useEffect, useState } from "react";
import { AcdRequestForm, type AcdProspectPrefill } from "@/components/acd-request-form";

export function AcdStagePortal(){
  const [prospect,setProspect]=useState<AcdProspectPrefill|null>(null);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    const open=async(event:Event)=>{
      const id=(event as CustomEvent<{prospectId:string}>).detail?.prospectId;
      if(!id)return;
      setError(null);setProspect(null);
      const response=await fetch(`/api/acd/${id}/demander`);
      const data=await response.json().catch(()=>({})) as AcdProspectPrefill&{error?:string};
      if(!response.ok){setError(data.error||"Impossible de préparer la demande d’ACD.");return;}
      setProspect(data);
    };
    window.addEventListener("open-acd-request-from-list",open);
    return()=>window.removeEventListener("open-acd-request-from-list",open);
  },[]);
  return <>{prospect?<AcdRequestForm key={prospect.id} prospect={prospect} hiddenTrigger openImmediately/>:null}{error?<div className="fixed bottom-5 right-5 z-[110] max-w-md rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-xl ring-1 ring-red-200">{error}</div>:null}</>;
}
