'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function ClientRow({href,children}:{href:string;children:React.ReactNode}) {
 const router=useRouter();
 return <tr tabIndex={0} role="link" onClick={()=>router.push(href)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();router.push(href);}}} className="cursor-pointer border-t border-navy-100 even:bg-slate-50/70 hover:bg-sky-50 focus:outline-2 focus:outline-sky-600">{children}</tr>;
}
export function ClientModal({closeHref,title,children}:{closeHref:string;title:string;children:React.ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null); const router=useRouter();
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} onCancel={e=>{e.preventDefault();router.push(closeHref);}} aria-label={`Fiche ${title}`} className="max-h-[90vh] w-[min(95vw,70rem)] rounded-2xl border border-sky-200 bg-white p-0 shadow-2xl backdrop:bg-navy-900/50"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><h2 className="text-xl font-bold text-navy-900">{title}</h2><button type="button" onClick={()=>router.push(closeHref)} aria-label="Fermer la fiche" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-sky-50">Fermer ✕</button></div><div className="space-y-4 p-5">{children}</div></dialog>;
}
