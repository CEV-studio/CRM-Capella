import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Database, FileCheck2, Inbox, MailCheck, ShieldCheck, Trash2, Users, Wallet } from "lucide-react";
import { Card } from "@/components/ui";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Espace admin — Capella CRM" };

const categories = [
  { titre: "Gestion des dossiers", description: "Traiter les demandes et suivre leur validation ADV.", icon: ShieldCheck, accent: "bg-sky-capella-50 text-sky-capella-700", liens: [
    { href: "/adv", label: "Espace ADV", icon: BarChart3 }, { href: "/admin/acd", label: "Demandes d’ACD", icon: FileCheck2 },
  ] },
  { titre: "Équipe & données", description: "Gérer les accès, les apporteurs et les données commerciales.", icon: Users, accent: "bg-violet-50 text-violet-700", liens: [
    { href: "/admin/commerciaux", label: "Équipe & apporteurs", icon: Users }, { href: "/admin/reservoir", label: "Réservoir & attribution", icon: Database }, { href: "/admin/corbeille", label: "Corbeille", icon: Trash2 },
  ] },
  { titre: "Emails & communication", description: "Centraliser les boîtes connectées et les modèles de messages.", icon: MailCheck, accent: "bg-amber-50 text-amber-700", liens: [
    { href: "/admin/emails", label: "Emails & templates", icon: MailCheck }, { href: "/admin/boites-email", label: "Boîtes e-mail", icon: Inbox },
  ] },
  { titre: "Reporting & facturation", description: "Accéder aux exports et au suivi de la production belge.", icon: Wallet, accent: "bg-emerald-50 text-emerald-700", liens: [
    { href: "/admin/export", label: "Export des données", icon: BarChart3 }, { href: "/belgique", label: "Production & facturation BE", icon: Wallet },
  ] },
];

export default async function AdminPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/");

  return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
    <header className="crm-page-header mb-7 flex flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-7">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-star-600"><ShieldCheck size={14} /> Administration</div>
        <h1 className="font-display text-2xl font-bold text-navy-800">Espace admin</h1>
        <p className="mt-1 text-sm text-grey-brand">Retrouvez les principaux outils de gestion par catégorie.</p>
      </div>
      <div className="hidden h-14 w-14 items-center justify-center rounded-2xl bg-[var(--crm-gradient-navy)] text-star-400 shadow-[var(--crm-shadow-card)] sm:flex"><ShieldCheck size={24} /></div>
    </header>
    <section aria-label="Catégories d’administration" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {categories.map((category) => { const Icon = category.icon; return <Card key={category.titre} className="flex min-h-64 flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex items-start justify-between gap-3"><div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${category.accent}`}><Icon size={23} strokeWidth={1.8} /></div><span className="rounded-full bg-navy-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-navy-500">{category.liens.length} accès</span></div>
        <h2 className="mt-4 font-display text-lg font-bold text-navy-800">{category.titre}</h2><p className="mt-1 min-h-10 text-sm leading-5 text-grey-brand">{category.description}</p>
        <ul className="mt-4 space-y-1 border-t border-navy-100 pt-3">{category.liens.map((lien) => { const LienIcon = lien.icon; return <li key={lien.href}><Link href={lien.href} className="group flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-navy-700 transition-colors hover:bg-sky-capella-50 hover:text-sky-capella-700"><LienIcon size={15} className="shrink-0 text-navy-400 group-hover:text-sky-capella-600" /><span className="min-w-0 flex-1">{lien.label}</span><ArrowRight size={14} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" /></Link></li>; })}</ul>
      </Card>; })}
    </section>
  </main>;
}
