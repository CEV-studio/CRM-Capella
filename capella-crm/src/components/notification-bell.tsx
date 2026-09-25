'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {Bell} from 'lucide-react';
export function NotificationBell(){
 const [count,setCount]=useState(0);const path=usePathname();
 useEffect(()=>{
  let live=true,pending=false;
  const refresh=()=>{if(pending||document.visibilityState==='hidden')return;pending=true;fetch('/api/partenaires/notifications').then(r=>r.json()).then(d=>{if(live)setCount(d.count??0);}).catch(()=>{}).finally(()=>{pending=false;});};
  refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);
  return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[path]);
 return <Link href="/notifications" className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-navy-800 shadow-sm" aria-label={`${count} notifications non lues`}><Bell size={18}/>{count>0?<span className="rounded-full bg-star-500 px-2 text-xs text-white">{count}</span>:null}</Link>;
}
