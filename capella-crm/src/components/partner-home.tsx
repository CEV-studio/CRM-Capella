import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Building2, CheckCircle2, CircleDollarSign, FileCheck2, Target } from "lucide-react";
import { partnerContext } from "@/lib/partners/server";
import { fmtEuros, fmtNombre } from "@/lib/format";

export async function PartnerHome({ prenom }: { prenom: string }) {
  const { profile, db } = await partnerContext();
  const { data: dossiers, error: dossierError } = await db.from("partner_dossiers").select("id,acd_status").eq("owner_id", profile.id);
  if (dossierError) throw new Error(`Impossible de charger vos indicateurs apporteur : ${dossierError.message}`);
  const liste = dossiers ?? [];
  const ids = liste.map((d) => d.id);
  const quotes: Array<{ status: string; signed_at: string | null; partner_commission: number | null }> = [];
  if (ids.length) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("partner_quotes").select("status,signed_at,partner_commission").in("dossier_id", ids).order("created_at").range(offset, offset + 999);
      if (error) throw new Error(`Impossible de charger vos cotations : ${error.message}`);
      quotes.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
  }
  const signees = quotes.filter((quote) => quote.signed_at);
  const commission = signees.reduce((sum, quote) => sum + Number(quote.partner_commission ?? 0), 0);
  const categories = [
    { title: "Opportunités", description: "Créer et suivre vos dossiers apportés.", href: "/partenaires/opportunites", icon: Target },
    { title: "Demandes de cotation", description: "Suivre les demandes transmises à l’ADV.", href: "/partenaires/cotations", icon: BriefcaseBusiness },
    { title: "Suivi des demandes d’ACD", description: "Voir les étapes de traitement de vos ACD.", href: "/suivi-acd", icon: FileCheck2 },
    { title: "Portefeuille clients", description: "Retrouver vos entreprises et contrats.", href: "/partenaires/portefeuille", icon: Building2 },
  ];
  return <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
    <header className="mb-8"><div className="mb-2 text-xs font-semibold uppercase tracking-[.13em] text-grey-brand">Tableau de bord apporteur</div><h1 className="font-display text-3xl font-semibold tracking-tight text-navy-900">Bonjour {prenom}</h1><p className="mt-2 text-sm text-grey-brand">Vos dossiers, cotations et commissions.</p></header>
    <section aria-label="Mes indicateurs" className="mb-9">
      <h2 className="mb-3 font-display text-lg font-semibold text-navy-900">Mes chiffres clés</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Dossiers apportés", value: fmtNombre(liste.length), icon: Target, note: "Votre portefeuille" },
          { label: "ACD signées", value: fmtNombre(liste.filter((d) => d.acd_status === "signee").length), icon: CheckCircle2, note: "Dossiers prêts pour cotation" },
          { label: "Cotations demandées", value: fmtNombre(quotes.length), icon: BriefcaseBusiness, note: "Toutes périodes" },
          { label: "Commissions signées", value: fmtEuros(commission), icon: CircleDollarSign, note: "Cotations avec date de signature" },
        ].map(({ label, value, icon: Icon, note }) => <article key={label} className="border border-navy-100 bg-white p-5"><div className="flex items-center justify-between gap-3 text-sm text-grey-brand"><span>{label}</span><Icon size={17} className="text-grey-brand" /></div><div className="mt-3 font-display text-3xl font-semibold text-navy-900">{value}</div><p className="mt-2 text-xs text-grey-brand">{note}</p></article>)}
      </div>
    </section>
    <section aria-label="Mes catégories">
      <h2 className="mb-3 font-display text-lg font-semibold text-navy-900">Accéder à une section</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{categories.map(({ title, description, href, icon: Icon }) => <Link key={href} href={href} className="group border border-navy-100 bg-white p-5 transition-colors hover:border-neutral-400"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center bg-sky-capella-50 text-navy-800"><Icon size={21} /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between font-display font-semibold text-navy-900">{title}<ArrowUpRight size={16} className="text-neutral-400 group-hover:text-navy-900" /></span><span className="mt-1 block text-sm text-grey-brand">{description}</span></span></div></Link>)}</div>
    </section>
  </main>;
}
