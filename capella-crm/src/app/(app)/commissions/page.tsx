import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui";
import { fmtEuros, fmtPourcent, MOIS, MOIS_COURTS } from "@/lib/format";
import { anneesDisponibles, filtrerAffaires } from "@/lib/domain/commissions";
import { FiltresPeriode } from "../filtres-periode";
import { chargerApporteurs } from "@/lib/referentiels";
import type { Affaire, Profile } from "@/lib/domain/database.types";

export const metadata = { title: "Commissions — Capella CRM" };
export const dynamic = "force-dynamic";

type Recherche = { annee?: string; mois?: string; commercial?: string; apporteur?: string };
const TH = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-300";

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<Recherche> }) {
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const filtres = await searchParams;
  const supabase = await createClient();

  const [{ data: affairesBrutes }, { data: profils }, apporteurs] = await Promise.all([
    supabase.from("affaires").select("commercial_id, apporteur_id, stage, date_signature, commission, raison_sociale, ref").is("deleted_at", null),
    supabase.from("profiles").select("id, full_name, commission_rate"),
    chargerApporteurs(),
  ]);

  const toutesAffaires = (affairesBrutes ?? []) as Affaire[];
  const listeProfils = (profils ?? []) as Pick<Profile, "id" | "full_name" | "commission_rate">[];
  const listeApporteurs = apporteurs;
  const profilParId = new Map(listeProfils.map((p) => [p.id, p]));
  const annees = anneesDisponibles(toutesAffaires);
  const annee = Number(filtres.annee) || annees[0];
  const mois = Number(filtres.mois) || undefined;

  const affairesFiltrees = filtrerAffaires(toutesAffaires, { annee, mois, commercialId: filtres.commercial, apporteurId: filtres.apporteur });
  const affairesValidees = affairesFiltrees.filter((a) => a.stage === "Signé" && a.date_signature);
  const enAttente = affairesFiltrees.filter((a) => a.stage !== "Signé" && a.stage !== "KO" && Number(a.commission ?? 0) > 0);

  type LigneCommercial = { id: string; nom: string; taux: number; parMois: number[]; caTotal: number; nbTotal: number };
  const parCommercial = new Map<string, LigneCommercial>();
  for (const p of listeProfils) parCommercial.set(p.id, { id: p.id, nom: p.full_name, taux: Number(p.commission_rate), parMois: Array(12).fill(0), caTotal: 0, nbTotal: 0 });

  for (const a of affairesValidees) {
    const ligne = parCommercial.get(a.commercial_id);
    if (!ligne) continue;
    const d = new Date(a.date_signature!);
    if (d.getUTCFullYear() !== annee) continue;
    const montant = Number(a.commission ?? 0);
    ligne.parMois[d.getUTCMonth()] += montant;
    ligne.caTotal += montant;
    ligne.nbTotal += 1;
  }

  const lignesCommerciaux = [...parCommercial.values()].filter((l) => l.nbTotal > 0 || estAdmin).sort((a, b) => b.caTotal - a.caTotal);
  const totalCa = lignesCommerciaux.reduce((s, l) => s + l.caTotal, 0);
  const totalCommissions = lignesCommerciaux.reduce((s, l) => s + l.caTotal * l.taux, 0);
  const totalParMois = Array.from({ length: 12 }, (_, m) => lignesCommerciaux.reduce((s, l) => s + l.parMois[m], 0));

  const parApporteur = listeApporteurs.map((ap) => {
    const siennes = affairesValidees.filter((a) => a.apporteur_id === ap.id);
    const ca = siennes.reduce((s, a) => s + Number(a.commission ?? 0), 0);
    return { ...ap, nb: siennes.length, ca, du: ca * Number(ap.commission_rate) };
  }).filter((a) => a.nb > 0);

  const periode = mois ? `${MOIS[mois - 1]} ${annee}` : `Année ${annee}`;
  const totalAttenteGlobal = enAttente.reduce((s, a) => s + Number(a.commission ?? 0), 0);
  const totalAttenteCommercial = enAttente.reduce((s, a) => s + Number(a.commission ?? 0) * Number(profilParId.get(a.commercial_id)?.commission_rate ?? 0), 0);

  return <main className="mx-auto w-full max-w-6xl px-6 py-8">
    <header className="mb-5"><h1 className="font-display text-2xl font-bold text-navy-800">Commissions</h1><p className="mt-1 text-sm text-grey-brand">Tes commissions sont séparées entre montants en attente et montants validés par l’ADV.</p></header>

    <div className="mb-5"><FiltresPeriode chemin="/commissions" annees={annees} commerciaux={estAdmin ? listeProfils.map((p) => ({ value: p.id, label: p.full_name })) : []} apporteurs={estAdmin ? listeApporteurs.map((a) => ({ value: a.id, label: a.name })) : []}/></div>

    <Card className="mb-6 overflow-hidden">
      <CardHeader title={estAdmin ? "Commissions en attente" : "Ma commission en attente"} hint={estAdmin ? `${fmtEuros(totalAttenteGlobal)} de commission globale Capella · ${fmtEuros(totalAttenteCommercial)} dus aux commerciaux après validation ADV.` : `${fmtEuros(totalAttenteCommercial)} déjà renseignés par l’ADV, en attente de validation finale.`}/>
      {enAttente.length === 0 ? <p className="px-5 py-6 text-sm text-grey-brand">Aucune commission en attente.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[44rem] border-collapse text-sm"><thead className="bg-navy-800"><tr><th className={TH}>Dossier</th>{estAdmin ? <th className={TH}>Commercial</th> : null}<th className={`${TH} text-right`}>Commission globale</th><th className={`${TH} text-right`}>{estAdmin ? "Commission commercial" : "Ma commission"}</th><th className={TH}>Étape</th></tr></thead><tbody>{enAttente.map((a) => { const p=profilParId.get(a.commercial_id); const due=Number(a.commission??0)*Number(p?.commission_rate??0); return <tr key={`${a.commercial_id}-${a.ref}`} className="border-b border-navy-100"><td className="px-3 py-2"><div className="font-medium text-navy-800">{a.raison_sociale}</div><div className="text-[11px] text-grey-brand">{a.ref}</div></td>{estAdmin?<td className="px-3 py-2">{p?.full_name??"—"}</td>:null}<td className="tabular px-3 py-2 text-right font-semibold">{fmtEuros(Number(a.commission??0))}</td><td className="tabular px-3 py-2 text-right font-bold text-star-600">{fmtEuros(due)}</td><td className="px-3 py-2">{a.stage}</td></tr>; })}</tbody></table></div>}
    </Card>

    <Card className="mb-6 overflow-hidden">
      <CardHeader title={estAdmin ? "Commissions validées par commercial" : "Ma commission validée"} hint={`Dossiers validés par l’ADV — ${periode}.`}/>
      <div className="scroll-slim overflow-x-auto"><table className="w-full min-w-[64rem] border-collapse text-sm"><thead className="bg-navy-800"><tr><th className={TH}>Commercial</th><th className={TH}>Taux</th>{MOIS_COURTS.map((m)=><th key={m} className={`${TH} text-right`}>{m}</th>)}<th className={`${TH} text-right`}>Montant validé</th><th className={`${TH} text-right`}>Commission due</th></tr></thead><tbody>
        {lignesCommerciaux.length === 0 ? <tr><td colSpan={16} className="px-3 py-8 text-center text-sm text-grey-brand">Aucun dossier validé sur cette période.</td></tr> : lignesCommerciaux.map((l)=><tr key={l.id} className="border-b border-navy-100"><td className="px-3 py-2 font-medium text-navy-800">{l.nom}</td><td className="tabular px-3 py-2 text-grey-brand">{fmtPourcent(l.taux)}</td>{l.parMois.map((v,i)=><td key={i} className={v>0?"tabular px-3 py-2 text-right text-navy-800":"tabular px-3 py-2 text-right text-navy-200"}>{v>0?Math.round(v).toLocaleString("fr-FR"):"—"}</td>)}<td className="tabular px-3 py-2 text-right font-semibold text-navy-800">{fmtEuros(l.caTotal)}</td><td className="tabular px-3 py-2 text-right font-bold text-star-600">{fmtEuros(l.caTotal*l.taux)}</td></tr>)}
        {lignesCommerciaux.length>0?<tr className="bg-navy-800 font-bold text-white"><td className="px-3 py-2">Total</td><td className="px-3 py-2"/>{totalParMois.map((v,i)=><td key={i} className="tabular px-3 py-2 text-right">{v>0?Math.round(v).toLocaleString("fr-FR"):"—"}</td>)}<td className="tabular px-3 py-2 text-right">{fmtEuros(totalCa)}</td><td className="tabular px-3 py-2 text-right">{fmtEuros(totalCommissions)}</td></tr>:null}
      </tbody></table></div>
    </Card>

    {estAdmin ? <Card className="overflow-hidden"><CardHeader title="Par apporteur d'affaires" hint="Ce que tu dois à tes apporteurs sur les dossiers validés." />{parApporteur.length===0?<p className="px-5 py-6 text-sm text-grey-brand">Aucun dossier validé avec un apporteur sur cette période.</p>:<table className="w-full border-collapse text-sm"><thead className="bg-navy-800"><tr><th className={TH}>Apporteur</th><th className={TH}>Taux</th><th className={`${TH} text-right`}>Affaires</th><th className={`${TH} text-right`}>Montant généré</th><th className={`${TH} text-right`}>Commission due</th><th className={TH}>Statut</th></tr></thead><tbody>{parApporteur.map((a)=><tr key={a.id} className="border-b border-navy-100"><td className="px-3 py-2 font-medium text-navy-800">{a.name}</td><td className="tabular px-3 py-2 text-grey-brand">{fmtPourcent(Number(a.commission_rate))}</td><td className="tabular px-3 py-2 text-right">{a.nb}</td><td className="tabular px-3 py-2 text-right">{fmtEuros(a.ca)}</td><td className="tabular px-3 py-2 text-right font-bold text-star-600">{fmtEuros(a.du)}</td><td className="px-3 py-2">{a.payment_status}</td></tr>)}</tbody></table>}</Card>:null}
  </main>;
}
