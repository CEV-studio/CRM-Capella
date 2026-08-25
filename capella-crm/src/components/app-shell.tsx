import Link from "next/link";
import { CapellaStar } from "@/components/brand";
import { peutGerer } from "@/lib/auth";
import type { Profile } from "@/lib/domain/database.types";

type NavItem = { href: string; label: string; adminOnly?: boolean; bientot?: boolean; needs?: (p: Profile) => boolean };

const NAV: { titre: string; items: NavItem[] }[] = [
  { titre: "Pilotage", items: [
    { href: "/", label: "Tableau de bord" },
    { href: "/prospection", label: "Prospection" },
    { href: "/conversion", label: "Conversion" },
    { href: "/commissions", label: "Commissions" },
    { href: "/admin/export", label: "Export", needs: (p) => peutGerer(p) || p.can_export },
  ]},
  { titre: "Administration", items: [
    { href: "/admin/acd", label: "ACD à traiter", needs: (p) => p.role === "admin" },
    { href: "/admin/emails", label: "Emails & templates", needs: (p) => p.role === "admin" },
    { href: "/admin/commerciaux", label: "Commerciaux", adminOnly: true },
    { href: "/admin/reservoir", label: "Réservoir & attribution", adminOnly: true },
    { href: "/admin/corbeille", label: "Corbeille", adminOnly: true },
  ]},
];

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const gere = peutGerer(profile);
  const visible = (i: NavItem) => (gere || !i.adminOnly) && (!i.needs || i.needs(profile));
  const sections = NAV.filter((s) => s.items.some(visible));
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-navy-800 text-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5"><CapellaStar className="h-6 w-6 text-star-500" /><span className="font-display text-base font-bold">Capella <span className="text-star-500">CRM</span></span></div>
        <nav className="flex-1 space-y-6 px-3 py-2">
          {sections.map((section) => <div key={section.titre}><div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy-300">{section.titre}</div><ul className="space-y-0.5">{section.items.filter(visible).map((item) => <li key={item.href}>{item.bientot ? <span className="flex cursor-default items-center justify-between rounded-lg px-2 py-1.5 text-sm text-navy-300">{item.label}<span className="text-[10px] uppercase tracking-wide">bientôt</span></span> : <Link href={item.href} className="block rounded-lg px-2 py-1.5 text-sm text-navy-100 transition-colors hover:bg-navy-700 hover:text-white">{item.label}</Link>}</li>)}</ul></div>)}
        </nav>
        <div className="border-t border-navy-700 px-5 py-4"><div className="truncate text-sm font-semibold">{profile.full_name}</div><div className="text-xs text-navy-300">{profile.role === "admin" ? "Administrateur" : gere ? "Gestion d'équipe" : "Commercial"}</div><Link href="/deconnexion" prefetch={false} className="mt-2 inline-block text-xs text-navy-300 underline underline-offset-2 hover:text-white">Se déconnecter</Link></div>
      </aside>
      <header className="fixed inset-x-0 top-0 z-10 flex items-center justify-between bg-navy-800 px-4 py-3 text-white md:hidden"><div className="flex items-center gap-2"><CapellaStar className="h-5 w-5 text-star-500" /><span className="font-display text-sm font-bold">Capella CRM</span></div><Link href="/deconnexion" prefetch={false} className="text-xs text-navy-300 underline">Quitter</Link></header>
      <div className="min-w-0 flex-1 pt-14 md:pt-0">{children}</div>
    </div>
  );
}
