"use client";

import Link from "next/link";
import { NotificationBell } from "@/components/notification-bell";
import { usePathname,useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  BarChart3, Building2, BriefcaseBusiness, CalendarDays,
  ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, CircleDollarSign, FileCheck2, FileDown,
  Home, Hourglass, LayoutDashboard, LogOut, Mail, Search, ShieldCheck, Target, Users,
} from "lucide-react";
import { CapellaStar, Logotype } from "@/components/brand";
import type { Profile } from "@/lib/domain/database.types";

type IconType = typeof LayoutDashboard;
type NavItem = { href: string; label: string; icon: IconType; adminOnly?: boolean; needs?: (p: Profile) => boolean };
type Section = { titre: string; href: string; icon: IconType; items: NavItem[] };
const peutGererLocal = (profile: Profile) => profile.role === "admin" || profile.can_manage_team;

const section = (titre: string, href: string, icon: IconType, items: NavItem[]): Section => ({ titre, href, icon, items });
const dashboard = { href: "/", label: "Tableau de bord", icon: LayoutDashboard };
const PARTNER_NAV = [
  section("Tableau de bord", "/", Home, [dashboard]),
  section("Suivi des demandes d’ACD", "/suivi-acd", FileCheck2, [
    { href: "/suivi-acd", label: "Suivi des demandes d’ACD", icon: FileCheck2 },
  ]),
  section("Demandes de cotation", "/partenaires/cotations", BriefcaseBusiness, [
    { href: "/partenaires/cotations", label: "Demandes de cotation", icon: BriefcaseBusiness },
  ]),
  section("Portefeuille clients", "/partenaires/portefeuille", Building2, [
    { href: "/partenaires/portefeuille", label: "Portefeuille clients", icon: Building2 },
  ]),
];
const QUALITY_NAV = [section("Qualité des ventes", "/qualite", ShieldCheck, [{href:"/qualite",label:"Tableau qualité",icon:ShieldCheck,needs:(p:Profile)=>['admin','qualite'].includes(p.role)},{href:"/qualite/ventes",label:"Appels à contrôler",icon:FileCheck2,needs:(p:Profile)=>['admin','qualite'].includes(p.role)}]),section("Production Belgique", "/belgique", ShieldCheck, [{href:"/belgique",label:"Production",icon:ShieldCheck},{href:"/belgique?tab=clients",label:"Base clients",icon:Users},{href:"/belgique/encoder",label:"Encoder une vente",icon:Users,needs:(p:Profile)=>p.role==='be_agent'}])];
const AGENT_NAV = [section("Mes ventes", "/belgique?tab=clients", Users, [{ href: "/belgique?tab=clients", label: "Mes ventes", icon: Users }, { href: "/belgique/encoder", label: "Encoder une vente", icon: FileCheck2 }])];
const COMMERCIAL_NAV = [
  section("Tableau de bord", "/", Home, [dashboard]),
  section("Suivi commercial", "/journee", Users, [
    { href: "/journee", label: "Ma journée", icon: Target },
    { href: "/echeances", label: "Échéances", icon: Hourglass },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/clients", label: "Dossiers en cours", icon: BriefcaseBusiness },
    { href: "/mes-clients", label: "Mes clients", icon: Building2 },
    { href: "/conversion", label: "Demandes de cotation", icon: FileCheck2 },
    { href: "/suivi-acd", label: "Suivi des demandes d’ACD", icon: FileCheck2 },
  ]),
  section("Prospection", "/prospection", Search, [
    { href: "/prospection", label: "Prospection", icon: Search },
  ]),
  section("Mon espace", "/email", Mail, [
    { href: "/email", label: "Mon email", icon: Mail },
  ]),
];
const MANAGER_NAV = [section("Mon équipe", "/equipe", Users, [{ href:"/equipe", label:"KPI de mon équipe", icon:BarChart3 }]), ...COMMERCIAL_NAV.slice(1)];
const ADMIN_NAV = [
  section("Tableau de bord", "/", Home, [dashboard]),
  section("Suivi commercial", "/clients", Users, [
    { href: "/clients", label: "Dossiers en cours", icon: BriefcaseBusiness },
    { href: "/mes-clients", label: "Mes clients", icon: Building2 },
    { href: "/journee", label: "Suivi de la journée", icon: Target },
    { href: "/echeances", label: "Échéances", icon: Hourglass },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/conversion", label: "Demandes de cotation", icon: FileCheck2 },
    { href: "/suivi-acd", label: "Suivi des demandes d’ACD", icon: FileCheck2 },
  ]),
  section("Apporteurs", "/partenaires/opportunites", Building2, [
    { href: "/partenaires/opportunites", label: "Opportunités apporteurs", icon: Target },
    { href: "/partenaires/cotations", label: "Demandes de cotation apporteurs", icon: BriefcaseBusiness },
    { href: "/partenaires/portefeuille", label: "Portefeuille apporteurs", icon: Building2 },
  ]),
  section("Prospection", "/prospection", Search, [
    { href: "/prospection", label: "Prospection", icon: Search },
  ]),
  section("ADV", "/adv", FileCheck2, [
    { href: "/adv", label: "Dossiers ADV", icon: FileCheck2 },
    { href: "/admin/acd", label: "Demandes d’ACD", icon: BriefcaseBusiness },
  ]),
  section("Comptabilité", "/commissions", CircleDollarSign, [
    { href: "/commissions", label: "Commissions et comptes", icon: CircleDollarSign },
    { href: "/comptabilite/belgique", label: "Belgique : factures et commissions", icon: CircleDollarSign },
    { href: "/admin/export", label: "Exports", icon: FileDown, needs: p => peutGererLocal(p) || p.can_export },
  ]),
  section("Belgique", "/belgique", Building2, [
    { href: "/belgique", label: "Production", icon: Building2 },
    { href: "/belgique?tab=clients", label: "Base clients", icon: Users },
    { href: "/belgique?tab=agents", label: "KPI agents", icon: BarChart3 },
  ]),
  section("Qualité des ventes", "/qualite", ShieldCheck, [
    { href: "/qualite", label: "Tableau qualité", icon: ShieldCheck },
    { href: "/qualite/ventes", label: "Appels à contrôler", icon: FileCheck2 },
  ]),
  section("Admin", "/admin/commerciaux", ShieldCheck, [
    { href: "/admin/commerciaux", label: "Création de comptes", icon: Users },
    { href: "/admin/equipes", label: "Équipes partenaires", icon: Users },
    { href: "/admin/produits", label: "Produits d’encodage", icon: Building2 },
    { href: "/admin/centres", label: "Comptes centres et agents", icon: Building2 },
    { href: "/admin/reservoir", label: "Réservoir", icon: BarChart3 },
    { href: "/admin/emails", label: "Modèles e-mail", icon: Mail },
    { href: "/admin/boites-email", label: "Boîtes e-mail", icon: Mail },
    { href: "/admin/corbeille", label: "Corbeille", icon: ShieldCheck },
    { href: "/email", label: "E-mail", icon: Mail },
  ]),
];

function actif(pathname: string, href: string) {
  const cleanHref = href.split("?")[0];
  const [currentPath,currentQuery=""]=pathname.split("?");
  const actual=new URLSearchParams(currentQuery),expected=new URLSearchParams(href.split("?")[1]||"");
  if([...expected].some(([key,value])=>actual.get(key)!==value))return false;
  if(href==="/belgique"&&actual.has("tab"))return false;
  pathname=currentPath;
  if (cleanHref === "/") return pathname === "/";
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}
function sectionActive(pathname: string, s: Section) {
  return s.items.some(item => actif(pathname, item.href));
}

const sidebarStorageKey = "capella-sidebar-collapsed";
let sidebarFallback = false;
function readSidebarCollapsed() {
  try { return window.localStorage.getItem(sidebarStorageKey) === "true"; }
  catch { return sidebarFallback; }
}
function subscribeSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("capella-sidebar-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("capella-sidebar-change", callback); };
}
function setSidebarCollapsed(value: boolean) {
  sidebarFallback = value;
  try { window.localStorage.setItem(sidebarStorageKey, String(value)); } catch { /* Browser storage may be unavailable. */ }
  window.dispatchEvent(new Event("capella-sidebar-change"));
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const path=usePathname();
  const search=useSearchParams();
  const pathname=path+(search.size?"?"+search.toString():"");
  const gere = peutGererLocal(profile);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebarCollapsed, () => false);
  const visible = (i: NavItem) => (!i.adminOnly || profile.role === "admin") && (!i.needs || i.needs(profile));
  const navigation = profile.role === 'be_agent' ? AGENT_NAV : ['qualite','be_centre'].includes(profile.role) ? QUALITY_NAV : profile.role === "apporteur" ? PARTNER_NAV : profile.role === "admin" ? ADMIN_NAV : profile.role === 'manager' ? MANAGER_NAV : COMMERCIAL_NAV;
  const sections = navigation.filter(s => s.items.some(visible));
  const currentSection = sections.find(s => sectionActive(pathname, s));
  const currentItem = currentSection?.items.filter(visible).find(item => actif(pathname, item.href));
  const toggle = (title: string, defaultOpen: boolean) => setOpenSections(current => ({ ...current, [title]: !(current[title] ?? defaultOpen) }));

  return <div className="crm-shell flex min-h-screen bg-surface">
    <aside className={`crm-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-navy-100 bg-[#f8fafc] text-navy-700 transition-[width] duration-200 md:flex ${collapsed ? "w-[68px]" : "w-64"}`}>
      <div className={`crm-sidebar-brand flex min-h-[76px] items-center border-b border-navy-100 bg-white ${collapsed ? "flex-col justify-center gap-1 py-2" : "justify-between gap-2 px-3 py-4"}`}>
        <Link href={profile.role === "be_agent" ? "/belgique?tab=clients" : "/"} className="flex min-w-0 justify-center" aria-label="Accueil Capella Energy">
          {collapsed ? <CapellaStar className="h-7 w-7" /> : <Logotype className="w-[170px]" />}
        </Link>
        <button type="button" onClick={() => setSidebarCollapsed(!collapsed)} aria-label={collapsed ? "Agrandir le menu" : "Réduire le menu"} title={collapsed ? "Agrandir le menu" : "Réduire le menu"} aria-expanded={!collapsed} className="rounded-lg p-2 text-navy-500 hover:bg-navy-50 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-sky-capella-500">
          {collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}
        </button>
      </div>
      <nav className={`scroll-slim flex-1 space-y-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
        {sections.map(s => {
          const items=s.items.filter(visible);
          const grouped=items.length>1;
          const isActive=sectionActive(pathname,s);
          const isOpen=openSections[s.titre]??isActive;
          const Icon=s.icon;
          if (collapsed) {
            const iconClass=`flex h-11 w-full items-center justify-center rounded-lg ${isActive ? "bg-white text-navy-900 shadow-sm ring-1 ring-navy-100" : "text-navy-500 hover:bg-white hover:text-navy-900"}`;
            return <div key={s.titre}>{grouped ? <button type="button" title={s.titre} aria-label={`Ouvrir ${s.titre}`} onClick={() => { setOpenSections(current => ({...current, [s.titre]: true})); setSidebarCollapsed(false); }} className={iconClass}><Icon size={19} aria-hidden/></button> : <Link href={items[0].href} title={s.titre} aria-label={s.titre} aria-current={actif(pathname,items[0].href) ? "page" : undefined} className={iconClass}><Icon size={19} aria-hidden/></Link>}</div>;
          }
          const heading=<><Icon size={17} strokeWidth={1.8} className="shrink-0 text-navy-500" aria-hidden/><span className="min-w-0 flex-1 text-left leading-5">{s.titre}</span>{isActive&&<span className="h-2 w-2 shrink-0 rounded-full bg-star-400" aria-label="Section actuelle"/>}</>;
          return <div key={s.titre}>
            {grouped?<button type="button" onClick={()=>toggle(s.titre,isActive)} aria-expanded={isOpen} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive?'bg-white text-navy-900 shadow-sm ring-1 ring-navy-100':'text-navy-600 hover:bg-white hover:text-navy-900'}`}>{heading}<ChevronDown size={15} className={`shrink-0 text-navy-200 ${isOpen?'rotate-180':''}`}/></button>:<Link href={items[0].href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive?'bg-white text-navy-900 shadow-sm ring-1 ring-navy-100':'text-navy-600 hover:bg-white hover:text-navy-900'}`}>{heading}</Link>}
            {grouped&&isOpen&&<ul className="mb-2 ml-5 mt-1 space-y-0.5 border-l border-navy-200 pl-3">
              {items.map(item=>{
                const itemActive=actif(pathname,item.href),ItemIcon=item.icon;
                return <li key={item.href}><Link href={item.href} aria-current={itemActive?'page':undefined} className={`flex items-start gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors ${itemActive?'bg-sky-capella-50 font-semibold text-sky-capella-700':'text-navy-600 hover:bg-white hover:text-navy-900'}`}><ItemIcon size={14} className="mt-0.5 shrink-0 text-navy-400"/><span className="min-w-0 flex-1 whitespace-normal leading-5">{item.label}</span>{itemActive&&<ChevronRight size={13} className="mt-1 shrink-0 text-star-300"/>}</Link></li>;
              })}
            </ul>}
          </div>;
        })}
      </nav>
      {collapsed ? <div className="crm-sidebar-footer flex flex-col items-center gap-2 border-t border-navy-100 py-4"><div title={profile.full_name} aria-label={profile.full_name} className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-700 text-sm font-semibold text-white">{profile.full_name.slice(0,1).toUpperCase()}</div><Link href="/deconnexion" prefetch={false} className="rounded-lg p-2 text-navy-500 hover:bg-white" aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={16} aria-hidden/></Link></div> :       <div className="crm-sidebar-footer border-t border-navy-100 px-4 py-4">
        <div className="crm-sidebar-user flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-700 font-display text-sm font-semibold text-white">{profile.full_name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-navy-900">{profile.full_name}</div><div className="truncate text-[11px] text-navy-500">{profile.role === "be_centre" ? "Centre Belgique" : profile.role === "be_agent" ? "Agent Belgique" : profile.role === "qualite" ? "Responsable qualité" : profile.role === "admin" ? "Administrateur" : profile.role === "manager" ? profile.hierarchy_title === "Leader" ? "Leader" : "Manager" : profile.role === "apporteur" ? "Apporteur" : gere ? "Gestion d’équipe" : "Commercial"}</div></div>
          <Link href="/deconnexion" prefetch={false} className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-50 hover:text-navy-900" aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={16} aria-hidden /></Link>
        </div>
      </div>
}
    </aside>

    <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-white/10 bg-navy-900 px-4 py-2.5 text-white md:hidden">
      <Link href={profile.role === "be_agent" ? "/belgique?tab=clients" : "/"} className="rounded bg-[#F5F3EE] px-2 py-1"><Logotype className="w-36" /></Link>
      <Link href="/deconnexion" prefetch={false} className="inline-flex items-center gap-1.5 text-xs text-navy-100"><LogOut size={14} /> Quitter</Link>
    </header>
    <div className="min-w-0 flex-1 pt-14 md:pt-0">
      <div className="crm-workspace-bar flex min-h-14 items-center justify-between border-b border-navy-100 bg-white/95 px-4 sm:px-6"><div className="flex min-w-0 items-center gap-2 text-sm"><Link href={profile.role === "be_agent" ? "/belgique?tab=clients" : "/"} className="hidden font-medium text-navy-500 hover:text-navy-900 sm:inline">Capella CRM</Link><span className="hidden text-navy-300 sm:inline" aria-hidden>/</span><span className="truncate font-semibold text-navy-800">{currentSection?.titre ?? "Accueil"}</span>{currentItem && currentItem.label !== currentSection?.titre && <><span className="text-navy-300" aria-hidden>/</span><span className="truncate text-navy-600">{currentItem.label}</span></>}</div>{!['qualite','be_centre','be_agent'].includes(profile.role)&&<NotificationBell />}</div>
      <nav className="flex items-start gap-2 overflow-x-auto border-b border-navy-100 bg-white p-3 md:hidden">{sections.map(s=>{
        const items=s.items.filter(visible),active=sectionActive(pathname,s);
        return items.length>1?<details key={s.titre} className="shrink-0 rounded-lg bg-navy-50"><summary className={`cursor-pointer whitespace-nowrap px-3 py-2 text-xs font-semibold ${active?'bg-sky-capella-100':''}`}>{s.titre}</summary><ul className="w-60 space-y-1 p-2">{items.map(item=><li key={item.href}><Link href={item.href} aria-current={actif(pathname,item.href)?'page':undefined} className={`block rounded-md px-3 py-2 text-xs leading-5 ${actif(pathname,item.href)?'bg-sky-capella-100 font-semibold':'hover:bg-white'}`}>{item.label}</Link></li>)}</ul></details>:<Link key={s.titre} href={items[0].href} className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs ${active?'bg-sky-capella-100 font-semibold':'bg-navy-50'}`}>{s.titre}</Link>;
      })}</nav>
      {children}
    </div>
  </div>;
}
