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
  const maximum = Math.max(1, ...mois.map((row) => row.france + row.belgique));
  return <div role="img" aria-label="Chiffre d’affaires mensuel signé France et MEGA Belgique">
    <div className="flex h-56 items-end gap-2 sm:gap-3">
      {mois.map((row) => {
        const franceHeight = (row.france / maximum) * 100;
        const belgiqueHeight = (row.belgique / maximum) * 100;
        return <div key={row.mois} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <span className="truncate text-[9px] font-medium text-neutral-500 sm:text-[10px]" title={fmtEuros(row.france + row.belgique)}>
            {(row.france + row.belgique) ? moneyCompact(row.france + row.belgique) : ""}
          </span>
          <div className="flex h-36 w-full max-w-12 items-end overflow-hidden rounded-t-md bg-neutral-100" title={`France : ${fmtEuros(row.france)} · Belgique : ${fmtEuros(row.belgique)}`}>
            <div className="flex h-full w-full flex-col justify-end">
              <div className="w-full bg-[#111827]" style={{ height: `${franceHeight}%` }} />
              <div className="w-full bg-[#a3a3a3]" style={{ height: `${belgiqueHeight}%` }} />
            </div>
          </div>
          <span className="text-[9px] font-medium uppercase text-neutral-500 sm:text-[10px]">{MOIS[row.mois - 1].slice(0, 3)}</span>
        </div>;
      })}
    </div>
    <div className="mt-5 flex flex-wrap gap-5 border-t border-neutral-200 pt-4 text-xs text-neutral-600">
      <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#111827]" /> Courtage pro France</span>
      <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#a3a3a3]" /> MEGA énergie Belgique</span>
    </div>
  </div>;
}

function Indicateur({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Euro }) {
  return <article className="min-h-36 border border-neutral-200 bg-white p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="text-sm font-medium text-neutral-500">{label}</div>
      <Icon size={18} strokeWidth={1.7} className="shrink-0 text-neutral-500" aria-hidden />
    </div>
    <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-neutral-900">{value}</div>
    <div className="mt-2 text-xs leading-5 text-neutral-500">{note}</div>
  </article>;
}

export function AdminHome(props: AdminHomeProps) {
  return <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.13em] text-neutral-500"><BarChart3 size={15} /> Tableau de bord global</div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-neutral-900">Bonjour {props.prenom}</h1>
        <p className="mt-2 text-sm text-neutral-500">Toute l’activité de Capella · année {props.annee}</p>
      </div>
      <span className="inline-flex items-center gap-2 border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600"><CheckCircle2 size={15} /> Vue administrateur complète</span>
    </header>

    <section aria-label="Indicateurs globaux" className="mb-10">
      <div className="mb-3 flex items-center gap-2"><ClipboardList size={17} className="text-neutral-500" /><h2 className="font-display text-lg font-semibold text-neutral-900">Les chiffres clés</h2></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicateur label={`CA global généré en ${props.annee}`} value={fmtEuros(props.caGlobalAnnuel)} note="France pro signé + MEGA énergie Belgique" icon={Euro} />
        <Indicateur label="Contrats MEGA effectifs ce mois" value={fmtNombre(props.megaEffectifsMois)} note="Contrats inscrits ce mois, actuellement effectifs" icon={CheckCircle2} />
        <Indicateur label="Dossiers courtage énergie pro en cours" value={fmtNombre(props.dossiersFranceEnCours)} note="France · hors dossiers signés et perdus" icon={BriefcaseBusiness} />
        <Indicateur label="CA courtage pro France ce mois" value={fmtEuros(props.caFranceMois)} note={MOIS[props.moisCourant - 1] + " · dossiers signés"} icon={Wallet} />
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-500">Le CA consolidé additionne les dossiers pro France signés et la part Capella MEGA énergie en Belgique (validée et prévisionnelle). Les autres activités et fournisseurs ne sont pas encore intégrés à ce total.</p>
    </section>

    <section aria-label="Chiffre d’affaires mensuel" className="mb-10 border border-neutral-200 bg-white p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-display text-lg font-semibold text-neutral-900">Évolution du chiffre d’affaires</h2><p className="mt-1 text-sm text-neutral-500">Tous les comptes · mois par mois · {props.annee}</p></div>
        <span className="inline-flex items-center gap-2 text-xs text-neutral-500"><BarChart3 size={15} /> CA signé / validé + prévision MEGA</span>
      </div>
      <Mensuel mois={props.mois} />
    </section>

    <section aria-label="Sections principales">
      <div className="mb-4"><h2 className="font-display text-lg font-semibold text-neutral-900">Accéder à une section</h2><p className="mt-1 text-sm text-neutral-500">Choisis un espace pour retrouver ses outils.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => {
          const Icon = category.icon;
          return <article key={category.title} className="border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-400">
            <Link href={category.href} className="group flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-neutral-100 text-neutral-800"><Icon size={21} strokeWidth={1.7} /></span>
              <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 font-display font-semibold text-neutral-900">{category.title}<ArrowUpRight size={16} className="text-neutral-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span><span className="mt-1 block text-sm leading-5 text-neutral-500">{category.description}</span></span>
            </Link>
            <ul className="mt-4 space-y-0.5 border-t border-neutral-200 pt-3">
              {category.links.map(([href, label]) => <li key={href}><Link href={href} className="block px-2 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950">{label}</Link></li>)}
            </ul>
          </article>;
        })}
      </div>
    </section>
  </main>;
}
