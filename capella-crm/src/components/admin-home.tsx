import Link from "next/link";
import {
  ArrowUpRight, BarChart3, BriefcaseBusiness, Building2, Calculator,
  CheckCircle2, ClipboardList, Euro, FileCheck2, Landmark,
  Search, ShieldCheck, Users, Wallet,
} from "lucide-react";
import { fmtEuros, fmtNombre, MOIS } from "@/lib/format";

type MoisStats = { mois: number; france: number; belgique: number };
type AdminHomeProps = {
  prenom: string;
  annee: number;
  caGlobalAnnuel: number;
  megaEffectifsMois: number;
  dossiersFranceEnCours: number;
  caFranceMois: number;
  mois: MoisStats[];
  moisCourant: number;
};

const categories = [
  { title: "Suivi commercial", description: "Commerciaux, clients et suivi des dossiers.", icon: Users, href: "/clients", links: [
    ["/admin/commerciaux", "Commerciaux"], ["/clients", "Dossiers en cours"], ["/mes-clients", "Clients"], ["/journee", "Suivi de la journée"], ["/echeances", "Échéances"], ["/agenda", "Agenda"],
  ] },
  { title: "Apport d’affaire", description: "Opportunités et portefeuille apporteurs.", icon: Building2, href: "/partenaires/opportunites", links: [
    ["/partenaires/opportunites", "Opportunités"], ["/partenaires/cotations", "Cotations"], ["/partenaires/portefeuille", "Portefeuille clients"],
  ] },
  { title: "Prospection", description: "Leads, relances et demandes entrantes.", icon: Search, href: "/prospection", links: [
    ["/prospection", "Espace prospection"], ["/conversion", "Demandes de cotation"],
  ] },
  { title: "ADV", description: "Validation et traitement administratif.", icon: FileCheck2, href: "/adv", links: [
    ["/adv", "Dossiers ADV"], ["/admin/acd", "Demandes d’ACD"],
  ] },
  { title: "Comptabilité / KPI", description: "Chiffres par compte et facturation.", icon: Calculator, href: "/commissions", links: [
    ["/commissions", "Commissions et comptes"], ["/admin/export", "Exports"], ["/belgique?tab=billing", "Facturation"],
  ] },
  { title: "Belgique", description: "Inscriptions, contrats et clawbacks.", icon: Landmark, href: "/belgique", links: [
    ["/belgique", "Vue Belgique"], ["/belgique?tab=cycles", "Cycles et clawbacks"],
  ] },
  { title: "Admin", description: "Comptes, accès et outils de gestion.", icon: ShieldCheck, href: "/admin/commerciaux", links: [
    ["/admin/commerciaux", "Création de comptes"], ["/admin/reservoir", "Réservoir"], ["/admin/emails", "Modèles e-mail"], ["/admin/boites-email", "Boîtes e-mail"], ["/admin/corbeille", "Corbeille"],
  ] },
] as const;

const moneyCompact = (value: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1,
}).format(value);

function Mensuel({ mois }: { mois: MoisStats[] }) {
  const max = Math.max(1, ...mois.map(row => row.france + row.belgique));
  const width = 1000, height = 210, left = 38, right = 16, top = 14, bottom = 30;
  const x = (i: number) => left + i * (width - left - right) / Math.max(1, mois.length - 1);
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max);
  const points = mois.map((row, i) => `${x(i)},${y(row.france + row.belgique)}`).join(" ");
  return <div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Évolution mensuelle du chiffre d’affaires France et Belgique" className="h-52 w-full overflow-visible" preserveAspectRatio="none">
      {[0, .25, .5, .75, 1].map(f => <line key={f} x1={left} x2={width-right} y1={y(max*f)} y2={y(max*f)} stroke="#dce5ee" strokeDasharray="4 5" />)}
      <polyline points={points} fill="none" stroke="#1E3155" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {mois.map((row,i) => <g key={row.mois}><circle cx={x(i)} cy={y(row.france + row.belgique)} r="4" fill="#E86030"><title>{`${MOIS[row.mois - 1]} : ${fmtEuros(row.france + row.belgique)} · France : ${fmtEuros(row.france)} · Belgique : ${fmtEuros(row.belgique)}`}</title></circle><text x={x(i)} y={height-4} textAnchor="middle" fill="#37485C" fontSize="12">{MOIS[row.mois - 1].slice(0, 3)}</text></g>)}
    </svg>
    <div className="mt-3 flex flex-wrap gap-5 border-t border-navy-100 pt-4 text-xs text-navy-600"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-sky-capella-500" /> France + Belgique</span></div>
  </div>;
}

function Indicateur({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Euro }) {
  return <article className="crm-home-kpi min-h-28 rounded-xl border border-navy-100 bg-white p-5 shadow-[0_4px_18px_rgba(7,30,61,0.055)]">
    <div className="flex items-start justify-between gap-3">
      <div className="text-sm font-medium text-grey-brand">{label}</div>
      <Icon size={18} strokeWidth={1.7} className="shrink-0 text-navy-700" aria-hidden />
    </div>
    <div className="mt-3 font-display text-2xl font-semibold tracking-tight text-navy-900">{value}</div>
    
  </article>;
}

export function AdminHome(props: AdminHomeProps) {
  return <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-navy-200 pb-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.13em] text-grey-brand"><BarChart3 size={15} /> Tableau de bord global</div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-navy-900">Bonjour {props.prenom}</h1>
        <p className="mt-2 text-sm text-grey-brand">Toute l’activité de Capella · année {props.annee}</p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3 py-2 text-xs font-medium text-navy-600"><CheckCircle2 size={15} /> Vue administrateur complète</span>
    </header>

    <section aria-label="Indicateurs globaux" className="mb-6">
      <div className="mb-3 flex items-center gap-2"><ClipboardList size={17} className="text-grey-brand" /><h2 className="font-display text-lg font-semibold text-navy-900">Les chiffres clés</h2></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicateur label={`CA global généré en ${props.annee}`} value={fmtEuros(props.caGlobalAnnuel)} note="France pro signé + MEGA énergie Belgique" icon={Euro} />
        <Indicateur label="Contrats MEGA effectifs ce mois" value={fmtNombre(props.megaEffectifsMois)} note="Contrats inscrits ce mois, actuellement effectifs" icon={CheckCircle2} />
        <Indicateur label="Dossiers courtage énergie pro en cours" value={fmtNombre(props.dossiersFranceEnCours)} note="France · hors dossiers signés et perdus" icon={BriefcaseBusiness} />
        <Indicateur label="CA courtage pro France ce mois" value={fmtEuros(props.caFranceMois)} note={MOIS[props.moisCourant - 1] + " · dossiers signés"} icon={Wallet} />
      </div>
      
    </section>

    <div className="mb-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
      <section aria-label="Chiffre d’affaires mensuel" className="crm-home-section min-w-0 rounded-xl border border-navy-100 bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold text-navy-900">Évolution du chiffre d’affaires</h2><p className="mt-1 text-sm text-grey-brand">France et Belgique · {props.annee}</p></div><span className="rounded-md border border-navy-200 bg-white px-2.5 py-1 text-xs font-semibold text-navy-600">{props.annee}</span></div>
        <Mensuel mois={props.mois}/>
      </section>
      <section aria-label="Accès directs" className="crm-home-section rounded-xl border border-navy-100 bg-white p-5">
        <div className="flex items-center justify-between border-b border-navy-100 pb-4"><h2 className="font-display text-lg font-semibold text-navy-900">Accès directs</h2><span className="text-xs font-medium text-grey-brand">Espace de travail</span></div>
        <div className="mt-2 divide-y divide-navy-100">{categories.map(category=>{const Icon=category.icon;return <Link key={category.title} href={category.href} className="group flex items-center gap-3 py-3 text-sm font-semibold text-navy-800 hover:text-star-700"><span className="crm-home-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"><Icon size={17}/></span><span className="min-w-0 flex-1">{category.title}</span><ArrowUpRight size={15} className="text-navy-400 group-hover:text-star-700"/></Link>})}</div>
      </section>
    </div>
    <section aria-label="Sections principales">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-semibold text-navy-900">Espaces de travail</h2><span className="text-xs font-medium text-grey-brand">{categories.length} espaces</span></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {categories.map(category=>{const Icon=category.icon;return <article key={category.title} className="crm-home-section flex min-w-0 flex-col rounded-xl border border-navy-100 bg-white p-5">
          <Link href={category.href} className="group flex items-center gap-3 border-b border-navy-100 pb-4"><span className="crm-home-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"><Icon size={19}/></span><span className="min-w-0 flex-1 font-display font-semibold text-navy-900">{category.title}</span><ArrowUpRight size={16} className="text-navy-400 group-hover:text-star-700"/></Link>
          <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">{category.links.map(([href,label])=><li key={href}><Link href={href} className="block rounded-md px-2 py-2 text-sm text-navy-600 hover:bg-navy-50 hover:text-navy-900">{label}</Link></li>)}</ul>
        </article>})}
      </div>
    </section>
  </main>;
}
