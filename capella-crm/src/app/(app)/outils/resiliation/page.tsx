import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResiliationPage({ searchParams }: { searchParams: Promise<{ prospect?: string }> }) {
  await requireProfile();
  const { prospect: prospectId } = await searchParams;
  if (!prospectId) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from("prospects")
    .select("id, raison_sociale, nom, prenom, mail, siren, pdl, pce, code_postal, date_fin_contrat")
    .eq("id", prospectId).is("deleted_at", null).maybeSingle();
  if (!p) notFound();

  const contact = [p.prenom, p.nom].filter(Boolean).join(" ");
  const livraison = p.pdl ?? p.pce ?? "";

  const fieldClass = "mt-1 h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-800 outline-none focus:border-star-500";
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <Link href={`/prospection/${p.id}`} className="text-sm text-grey-brand underline underline-offset-2 hover:text-navy-700">← Retour à la fiche</Link>
      <h1 className="mt-3 font-display text-2xl font-bold text-navy-800">Lettre de résiliation</h1>
      <p className="mt-1 text-sm text-grey-brand">Les données connues sont préremplies. Vérifie les éléments contractuels avant de générer le PDF.</p>

      <form action="/api/outils/resiliation" method="post" target="_blank" className="mt-6 rounded-xl border border-navy-100 bg-white p-6">
        <input type="hidden" name="prospect_id" value={p.id} />
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-navy-800">Nom de la société *<input required name="nom_societe" defaultValue={p.raison_sociale ?? ""} className={fieldClass} /></label>
          <label className="text-sm font-medium text-navy-800">Nom du représentant / gérant *<input required name="nom_gerant" defaultValue={contact} className={fieldClass} /></label>
          <label className="text-sm font-medium text-navy-800">SIRET / SIREN *<input required name="siret" defaultValue={p.siren ?? ""} className={fieldClass} /></label>
          <label className="text-sm font-medium text-navy-800">PDL / PCE *<input required name="pdl" defaultValue={livraison} className={fieldClass} /></label>
          <label className="text-sm font-medium text-navy-800">Adresse de la société *<input required name="adresse_societe" placeholder="Adresse complète" className={fieldClass} /></label>
          <label className="text-sm font-medium text-navy-800">Adresse postale de confirmation *<input required name="adresse_postale" placeholder="Adresse complète" className={fieldClass} /></label>
          <label className="text-sm font-medium text-navy-800 md:col-span-2">Adresse du fournisseur *<input required name="adresse_fournisseur" placeholder="Service résiliation, fournisseur, adresse complète" className={fieldClass} /></label>
          <label className="text-sm font-medium text-navy-800">Date d’échéance *<input required name="echeance" placeholder="JJ/MM/AAAA" defaultValue={p.date_fin_contrat ?? ""} className={fieldClass} /></label>
          <label className="text-sm font-medium text-navy-800">Email de confirmation *<input required type="email" name="email" defaultValue={p.mail ?? ""} className={fieldClass} /></label>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-star-500 px-4 text-sm font-semibold text-white hover:bg-star-600">Générer la lettre PDF</button>
        </div>
      </form>
    </main>
  );
}
