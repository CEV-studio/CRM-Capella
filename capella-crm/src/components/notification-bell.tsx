'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
export function NotificationBell({syncQuality=false}:{syncQuality?:boolean}){
 const [count,setCount]=useState(0);
 useEffect(()=>{
  let live=true,pending=false,again=false;
  const refresh=()=>{if(document.visibilityState==='hidden')return;if(pending){again=true;return;}pending=true;fetch('/api/partenaires/notifications').then(r=>r.json()).then(d=>{if(live)setCount(d.count??0);}).catch(()=>{}).finally(()=>{pending=false;if(live&&again){again=false;refresh();}});};
  refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);window.addEventListener('crm-notifications-changed',refresh);
  const sync=()=>{if(!syncQuality||document.visibilityState==='hidden')return;fetch('/api/qualite/signalements/email-sync',{method:'POST'}).then(()=>refresh()).catch(()=>{});};
  sync();const mailTimer=setInterval(sync,300000);
  return()=>{live=false;clearInterval(timer);clearInterval(mailTimer);window.removeEventListener('focus',refresh);window.removeEventListener('crm-notifications-changed',refresh);};
 },[syncQuality]);
 return <Link href="/notifications" className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-navy-800 shadow-sm" aria-label={`${count} notifications non lues`}><Bell size={18}/>{count>0?<span className="rounded-full bg-star-500 px-2 text-xs text-white">{count}</span>:null}</Link>;
}
