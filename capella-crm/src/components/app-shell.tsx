"use client";

import Link from "next/link";
import { NotificationBell } from "@/components/notification-bell";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Building2, BriefcaseBusiness, CalendarDays,
  ChevronDown, ChevronRight, CircleDollarSign, FileCheck2, FileDown,
  Home, Hourglass, LayoutDashboard, LogOut, Mail, Search, ShieldCheck, Target, Users,
} from "lucide-react";
import { Logotype } from "@/components/brand";
import type { Profile } from "@/lib/domain/database.types";

type IconType = typeof LayoutDashboard;
type NavItem = { href: string; label: string; icon: IconType; adminOnly?: boolean; needs?: (p: Profile) => boolean };
type Section = { titre: string; href: string; icon: IconType; items: NavItem[] };
const peutGererLocal = (profile: Profile) => profile.role === "admin" || profile.can_manage_team;

const section = (titre: string, href: string, icon: IconType, items: NavItem[]): Section => ({ titre, href, icon, items });
const dashboard = { href: "/", label: "Tableau de bord", icon: LayoutDashboard };
const PARTNER_NAV = [
  section("Tableau de bord", "/", Home, [dashboard]),
  section("Apport d’affaire", "/partenaires/opportunites", Building2, [
    { href: "/partenaires/opportunites", label: "Opportunités", icon: Target },
    { href: "/suivi-acd", label: "Suivi des demandes d’ACD", icon: FileCheck2 },
    { href: "/partenaires/cotations", label: "Cotations", icon: BriefcaseBusiness },
    { href: "/partenaires/portefeuille", label: "Portefeuille clients", icon: Building2 },
  ]),
];
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
  section("Comptabilité / KPI", "/commissions", CircleDollarSign, [
    { href: "/commissions", label: "Mes commissions", icon: CircleDollarSign },
  ]),
  section("Mon espace", "/email", Mail, [
    { href: "/email", label: "Mon email", icon: Mail },
  ]),
];
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
  section("Apport d’affaire", "/partenaires/opportunites", Building2, [
    { href: "/partenaires/opportunites", label: "Opportunités", icon: Target },
    { href: "/partenaires/cotations", label: "Cotations", icon: BriefcaseBusiness },
    { href: "/partenaires/portefeuille", label: "Portefeuille clients", icon: Building2 },
  ]),
  section("Prospection", "/prospection", Search, [
    { href: "/prospection", label: "Prospection", icon: Search },
  ]),
  section("ADV", "/adv", FileCheck2, [
    { href: "/adv", label: "Dossiers ADV", icon: FileCheck2 },
    { href: "/admin/acd", label: "Demandes d’ACD", icon: BriefcaseBusiness },
  ]),
  section("Comptabilité / KPI", "/commissions", CircleDollarSign, [
    { href: "/commissions", label: "Commissions et comptes", icon: CircleDollarSign },
    { href: "/admin/export", label: "Exports", icon: FileDown, needs: p => peutGererLocal(p) || p.can_export },
  ]),
  section("Belgique", "/belgique", Building2, [
    { href: "/belgique", label: "Inscriptions et production", icon: Building2 },
  ]),
  section("Admin", "/admin/commerciaux", ShieldCheck, [
    { href: "/admin/commerciaux", label: "Création de comptes", icon: Users },
    { href: "/admin/reservoir", label: "Réservoir", icon: BarChart3 },
    { href: "/admin/emails", label: "Modèles e-mail", icon: Mail },
    { href: "/admin/boites-email", label: "Boîtes e-mail", icon: Mail },
    { href: "/admin/corbeille", label: "Corbeille", icon: ShieldCheck },
    { href: "/email", label: "E-mail", icon: Mail },
  ]),
];

function actif(pathname: string, href: string) {
  const cleanHref = href.split("?")[0];
  if (cleanHref === "/") return pathname === "/";
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}
function sectionActive(pathname: string, s: Section) {
  return s.items.some(item => actif(pathname, item.href));
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const gere = peutGererLocal(profile);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const visible = (i: NavItem) => (!i.adminOnly || profile.role === "admin") && (!i.needs || i.needs(profile));
  const navigation = profile.role === "apporteur" ? PARTNER_NAV : profile.role === "admin" ? ADMIN_NAV : COMMERCIAL_NAV;
  const sections = navigation.filter(s => s.items.some(visible));
  const toggle = (title: string, defaultOpen: boolean) => setOpenSections(current => ({ ...current, [title]: !(current[title] ?? defaultOpen) }));

  return <div className="crm-shell flex min-h-screen bg-[#f6f8fb]">
    <aside className="hidden w-64 shrink-0 flex-col border-r border-navy-100 bg-[#f6f8fb] text-navy-900 md:flex">
      <Link href="/" className="flex justify-center border-b border-navy-100 bg-white px-5 py-5" aria-label="Accueil Capella Energy">
        <Logotype className="w-[190px]" />
      </Link>
      <nav className="scroll-slim flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {sections.map(s => {
          const isActive = sectionActive(pathname, s);
          const isOpen = openSections[s.titre] ?? isActive;
          const Icon = s.icon;
          return <div key={s.titre}>
            <div className={`flex items-center rounded-lg ${isActive ? "bg-sky-capella-50" : "hover:bg-sky-capella-50"}`}>
              <Link href={s.href} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm font-medium text-navy-800">
                <Icon size={17} strokeWidth={1.8} className="shrink-0 text-navy-600" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{s.titre}</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-star-500" aria-label="Section actuelle" />}
              </Link>
              {s.items.length > 1 && <button type="button" onClick={() => toggle(s.titre, isActive)} aria-label={`${isOpen ? "Replier" : "Déplier"} ${s.titre}`} aria-expanded={isOpen} className="px-2 py-2.5 text-grey-brand hover:text-navy-900"><ChevronDown size={15} className={isOpen ? "rotate-180" : ""} /></button>}
            </div>
            {s.items.length > 1 && isOpen && <ul className="mb-2 ml-5 mt-1 space-y-0.5 border-l border-navy-200 pl-3">
              {s.items.filter(visible).filter(item => item.href !== s.href).map(item => {
                const itemActive = actif(pathname, item.href);
                const ItemIcon = item.icon;
                return <li key={item.href}><Link href={item.href} className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors ${itemActive ? "bg-white font-semibold text-navy-900" : "text-navy-600 hover:bg-sky-capella-50 hover:text-navy-900"}`}>
                  <ItemIcon size={14} className="shrink-0 text-grey-brand" /><span className="min-w-0 flex-1 truncate">{item.label}</span>{itemActive && <ChevronRight size={13} />}
                </Link></li>;
              })}
            </ul>}
          </div>;
        })}
      </nav>
      <div className="border-t border-navy-100 px-4 py-4">
        <div className="flex items-center gap-3 border border-navy-100 bg-white p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800 font-display text-sm font-semibold text-white">{profile.full_name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-navy-900">{profile.full_name}</div><div className="truncate text-[11px] text-grey-brand">{profile.role === "admin" ? "Administrateur" : profile.role === "apporteur" ? "Apporteur" : gere ? "Gestion d’équipe" : "Commercial"}</div></div>
          <Link href="/deconnexion" prefetch={false} className="p-1.5 text-grey-brand hover:bg-navy-50 hover:text-navy-900" aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={16} aria-hidden /></Link>
        </div>
      </div>
    </aside>

    <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-navy-100 bg-[#f6f8fb] px-4 py-2.5 md:hidden">
      <Link href="/"><Logotype className="w-36" /></Link>
      <Link href="/deconnexion" prefetch={false} className="inline-flex items-center gap-1.5 text-xs text-navy-600"><LogOut size={14} /> Quitter</Link>
    </header>
    <div className="min-w-0 flex-1 pt-14 md:pt-0">
      <div className="flex justify-end border-b border-navy-100 bg-white px-6 py-2"><NotificationBell /></div>
      <nav className="flex gap-2 overflow-x-auto border-b border-navy-100 bg-white p-3 md:hidden">{sections.map(s => <Link key={s.titre} href={s.href} className={`whitespace-nowrap px-3 py-2 text-xs ${sectionActive(pathname, s) ? "bg-sky-capella-100 font-semibold" : "bg-navy-50"}`}>{s.titre}</Link>)}</nav>
      {children}
    </div>
  </div>;
}
