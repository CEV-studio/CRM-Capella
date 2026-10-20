import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  BriefcaseBusiness,
  CircleDollarSign,
  Database,
  FileCheck2,
  Inbox,
  MailCheck,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { Card, KpiTile } from "@/components/ui";
import { fmtEuros, fmtNombre, fmtPourcent, MOIS } from "@/lib/format";

type MoisStats = { mois: number; nbSignees: number; caSigne: number };
type EtapeStats = { stage: string; total: number };
type AdminHomeProps = {
  prenom: string;
  annee: number;
  prospectsTotal: number;
  affairesTotal: number;
  affairesEnCours: number;
  tauxConversion: number;
  mois: MoisStats[];
  prospectsParEtape: EtapeStats[];
  affairesParEtape: EtapeStats[];
};

const categories = [
  {
    titre: "Gestion des dossiers",
    description: "Demandes, validation et suivi ADV.",
    icon: ShieldCheck,
    accent: "bg-sky-capella-50 text-sky-capella-700",
    liens: [
      { href: "/adv", label: "Espace ADV", icon: FileCheck2 },
      { href: "/admin/acd", label: "Demandes d’ACD", icon: BriefcaseBusiness },
    ],
  },
  {
    titre: "Équipe & données",
    description: "Commerciaux, apporteurs et données commerciales.",
    icon: Users,
    accent: "bg-violet-50 text-violet-700",
    liens: [
      { href: "/admin/commerciaux", label: "Équipe & apporteurs", icon: Users },
      { href: "/admin/reservoir", label: "Réservoir & attribution", icon: Database },
      { href: "/admin/corbeille", label: "Corbeille", icon: Trash2 },
    ],
  },
  {
    titre: "Emails & communication",
    description: "Boîtes connectées et modèles de messages.",
    icon: MailCheck,
    accent: "bg-amber-50 text-amber-700",
    liens: [
      { href: "/admin/emails", label: "Emails & templates", icon: MailCheck },
      { href: "/admin/boites-email", label: "Boîtes e-mail", icon: Inbox },
    ],
  },
  {
    titre: "Reporting & facturation",
    description: "Exports et suivi de la production belge.",
    icon: Wallet,
    accent: "bg-emerald-50 text-emerald-700",
    liens: [
      { href: "/admin/export", label: "Export des données", icon: BarChart3 },
      { href: "/belgique", label: "Production & facturation BE", icon: CircleDollarSign },
    ],
  },
];

function BarresMensuelles({ mois, cle, format }: {
  mois: MoisStats[];
  cle: "nbSignees" | "caSigne";
  format: (value: number) => string;
}) {
  const max = Math.max(1, ...mois.map((m) => m[cle]));
  return (
    <div className="flex h-56 items-end gap-1.5 sm:gap-2">
      {mois.map((m) => {
        const value = m[cle];
        const height = value > 0 ? Math.max(5, (value / max) * 100) : 0;
        return (
          <div key={m.mois} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="max-w-full truncate text-[9px] font-semibold text-navy-600 sm:text-[10px]">{value > 0 ? format(value) : ""}</span>
            <div className="flex h-36 w-full items-end justify-center rounded-t-md bg-navy-50">
              <div className="w-full max-w-9 rounded-t-md bg-sky-capella-600 transition-all" style={{ height: `${height}%` }} />
            </div>
            <span className="text-[9px] font-semibold uppercase text-grey-brand sm:text-[10px]">{MOIS[m.mois - 1].slice(0, 3)}</span>
          </div>
        );
      })}
    </div>
  );
}

function RepartitionEtapes({ titre, lignes }: { titre: string; lignes: EtapeStats[] }) {
  const maximum = Math.max(1, ...lignes.map((ligne) => ligne.total));
  return (
    <Card className="p-5">
      <h2 className="font-display text-base font-bold text-navy-800">{titre}</h2>
      <div className="mt-4 space-y-3">
        {lignes.map((ligne) => (
          <div key={ligne.stage}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-navy-700">{ligne.stage}</span>
              <span className="tabular font-bold text-navy-800">{fmtNombre(ligne.total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-navy-50">
              <div className="h-full rounded-full bg-sky-capella-600" style={{ width: `${ligne.total > 0 ? Math.max(2, (ligne.total / maximum) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AdminHome(props: AdminHomeProps) {
  const caAnnee = props.mois.reduce((total, ligne) => total + ligne.caSigne, 0);
  const signaturesAnnee = props.mois.reduce((total, ligne) => total + ligne.nbSignees, 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="crm-page-header mb-6 flex flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-7">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-star-600"><BarChart3 size={14} /> Vue consolidée · toute l’équipe</div>
          <h1 className="font-display text-2xl font-bold text-navy-800">Bonjour {props.prenom}, Capella avance.</h1>
          <p className="mt-1 text-sm text-grey-brand">Tous les commerciaux, apporteurs et dossiers réunis dans une seule vue.</p>
        </div>
        <div className="hidden h-14 w-14 items-center justify-center rounded-2xl bg-[var(--crm-gradient-navy)] text-star-400 shadow-[var(--crm-shadow-card)] sm:flex"><Building2 size={24} /></div>
      </header>

      <section aria-label="Catégories principales" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Card key={category.titre} className="flex min-h-64 flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl {category.accent}">
                <Icon size={23} strokeWidth={1.8} />
              </div>
              <h2 className="mt-4 font-display text-lg font-bold text-navy-800">{category.titre}</h2>
              <p className="mt-1 min-h-10 text-sm leading-5 text-grey-brand">{category.description}</p>
              <ul className="mt-4 space-y-1 border-t border-navy-100 pt-3">
                {category.liens.map((lien) => {
                  const LienIcon = lien.icon;
                  return <li key={lien.href}><Link href={lien.href} className="group flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-navy-700 transition-colors hover:bg-sky-capella-50 hover:text-sky-capella-700"><LienIcon size={15} className="shrink-0 text-navy-400 group-hover:text-sky-capella-600" /><span className="min-w-0 flex-1">{lien.label}</span><ArrowRight size={14} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" /></Link></li>;
                })}
              </ul>
            </Card>
          );
        })}
      </section>

      <section aria-label="Indicateurs globaux" className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="font-display text-xl font-bold text-navy-800">L’activité, tous dossiers confondus</h2><p className="mt-1 text-sm text-grey-brand">Indicateurs globaux · année {props.annee}</p></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800"><Users size={14} /> Équipe complète</span>
        </div>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile label="Prospects suivis" value={fmtNombre(props.prospectsTotal)} hint="Tous les statuts du CRM" />
          <KpiTile label="Dossiers en cours" value={fmtNombre(props.affairesEnCours)} hint="Toutes les affaires ouvertes" />
          <KpiTile label={`Validés ADV en ${props.annee}`} value={fmtNombre(signaturesAnnee)} hint="Équipe complète" />
          <KpiTile label={`Montant validé en ${props.annee}`} value={fmtEuros(caAnnee)} hint={`Taux de conversion global : ${fmtPourcent(props.tauxConversion)}`} />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-display text-base font-bold text-navy-800">Dossiers validés par mois</h3><p className="mt-1 text-xs text-grey-brand">Nombre de validations ADV · {props.annee}</p></div><BriefcaseBusiness size={18} className="text-sky-capella-700" /></div>
            <BarresMensuelles mois={props.mois} cle="nbSignees" format={(v) => fmtNombre(v)} />
          </Card>
          <Card className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-display text-base font-bold text-navy-800">Montant validé par mois</h3><p className="mt-1 text-xs text-grey-brand">Montants enregistrés dans les dossiers · {props.annee}</p></div><CircleDollarSign size={18} className="text-star-600" /></div>
            <BarresMensuelles mois={props.mois} cle="caSigne" format={(v) => fmtEuros(v)} />
          </Card>
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <RepartitionEtapes titre="Prospection par étape" lignes={props.prospectsParEtape} />
          <RepartitionEtapes titre="Dossiers par étape" lignes={props.affairesParEtape} />
        </div>
      </section>
    </main>
  );
}
