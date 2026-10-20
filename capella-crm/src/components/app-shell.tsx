"use client";

import Link from "next/link";
import { NotificationBell } from "@/components/notification-bell";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Database,
  Hourglass,
  FileCheck2,
  FileDown,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  MailCheck,
  ShieldCheck,
  Target,
  Trash2,
  Users,
  ChevronDown,
} from "lucide-react";
import { Logotype } from "@/components/brand";
import type { Profile } from "@/lib/domain/database.types";

type IconType = typeof LayoutDashboard;
type NavItem = { href: string; label: string; icon: IconType; adminOnly?: boolean; needs?: (p: Profile) => boolean };
const peutGererLocal = (profile: Profile) => profile.role === "admin" || profile.can_manage_team;

const PARTNER_NAV: { titre: string; items: NavItem[] }[] = [{titre:"Espace apporteur",items:[
 {href:"/partenaires/opportunites",label:"Opportunités",icon:Target},
 {href:"/partenaires/cotations",label:"Cotations",icon:BriefcaseBusiness},
 {href:"/partenaires/portefeuille",label:"Portefeuille clients",icon:Building2},
]}];
const NAV: { titre: string; items: NavItem[] }[] = [
  { titre: "Vue d’ensemble", items: [
    { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  ] },
  { titre: "Suivi commercial", items: [
    { href: "/journee", label: "Ma journée", icon: Target },
    { href: "/echeances", label: "Échéances", icon: Hourglass },
    { href: "/agenda", label: "Mon agenda", icon: CalendarDays },
  ] },
  { titre: "Prospection & dossiers", items: [
    { href: "/prospection", label: "Prospection", icon: BarChart3 },
    { href: "/clients", label: "Dossiers en cours", icon: Users },
    { href: "/conversion", label: "Demandes de cotation", icon: BriefcaseBusiness },
  ] },
  { titre: "Clients & commissions", items: [
    { href: "/mes-clients", label: "Mes clients", icon: Building2 },
    { href: "/commissions", label: "Mes commissions", icon: CircleDollarSign },
  ] },
  { titre: "Réglages", items: [
    { href: "/email", label: "Mon email", icon: Mail },
  ] },
  { titre: "Admin", items: [
    { href: "/adv", label: "ADV", icon: ShieldCheck, adminOnly: true },
    { href: "/admin/acd", label: "Demandes d’ACD", icon: FileCheck2, adminOnly: true },
    { href: "/admin/emails", label: "Emails & templates", icon: MailCheck, adminOnly: true },
    { href: "/admin/boites-email", label: "Boîtes e-mail", icon: Inbox, adminOnly: true },
    { href: "/admin/commerciaux", label: "Équipe & apporteurs", icon: Users, adminOnly: true },
    { href: "/admin/reservoir", label: "Réservoir & attribution", icon: Database, adminOnly: true },
    { href: "/admin/export", label: "Export", icon: FileDown, needs: p => peutGererLocal(p) || p.can_export },
    { href: "/admin/corbeille", label: "Corbeille", icon: Trash2, adminOnly: true },
  ] },
];

function actif(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const gere = peutGererLocal(profile);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const visible = (i: NavItem) => (!i.adminOnly || profile.role === "admin") && (!i.needs || i.needs(profile));
  const navigation = profile.role === "apporteur" ? PARTNER_NAV : profile.role === "admin" ? [...PARTNER_NAV,...NAV] : NAV;
  const sections = navigation.filter(s => s.items.some(visible));

  return (
    <div className="crm-shell flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 [background:var(--crm-gradient-navy)] text-white shadow-[8px_0_28px_rgba(8,17,30,.10)] md:flex">
        <Link href="/" className="relative flex justify-center px-5 py-6" aria-label="Accueil Capella Energy">
          <Logotype className="w-[190px]" />
          <span className="absolute inset-x-7 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden />
        </Link>

        <nav className="scroll-slim flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {sections.map(section => (
            <div key={section.titre}>
              <button type="button" onClick={() => setOpenSections(current => ({ ...current, [section.titre]: !(current[section.titre] ?? section.items.some(item => actif(pathname, item.href))) }))} aria-expanded={openSections[section.titre] ?? section.items.some(item => actif(pathname, item.href))} className="flex w-full items-center justify-between px-3 pb-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 hover:text-white">
                <span>{section.titre}</span><ChevronDown size={13} className={`transition-transform ${openSections[section.titre] ?? section.items.some(item => actif(pathname, item.href)) ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {(openSections[section.titre] ?? section.items.some(item => actif(pathname, item.href))) ? <ul className="space-y-1">
                {section.items.filter(visible).map(item => {
                  const isActive = actif(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link href={item.href} className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive ? "bg-white/[.10] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" : "text-slate-200 hover:bg-white/[.06] hover:text-white"}`}>
                        {isActive ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-star-500" aria-hidden /> : null}
                        <Icon size={17} strokeWidth={1.9} className={isActive ? "text-star-400" : "text-slate-400 group-hover:text-white"} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {isActive ? <ChevronRight size={14} className="text-star-300" aria-hidden /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul> : null}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 bg-black/10 px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.05] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-star-500 font-display text-sm font-bold text-white">{profile.full_name.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{profile.full_name}</div><div className="truncate text-[11px] text-slate-400">{profile.role === "admin" ? "Administrateur" : profile.role === "apporteur" ? "Apporteur" : gere ? "Gestion d'équipe" : "Commercial"}</div></div>
            <Link href="/deconnexion" prefetch={false} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={16} aria-hidden /></Link>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-white/10 bg-navy-900 px-4 py-2.5 text-white shadow-md md:hidden">
        <Link href="/"><Logotype className="w-36" /></Link>
        <Link href="/deconnexion" prefetch={false} className="inline-flex items-center gap-1.5 text-xs text-slate-300"><LogOut size={14} /> Quitter</Link>
      </header>

      <div className="min-w-0 flex-1 pt-14 md:pt-0"><div className="flex justify-end border-b border-navy-100 px-6 py-2"><NotificationBell/></div><nav className="flex gap-2 overflow-x-auto border-b border-navy-100 bg-white p-3 md:hidden">{sections.flatMap(s=>s.items.filter(visible)).map(i=><Link key={i.href} href={i.href} className="whitespace-nowrap rounded-lg bg-navy-50 px-3 py-2 text-xs">{i.label}</Link>)}</nav>{children}</div>
    </div>
  );
}
