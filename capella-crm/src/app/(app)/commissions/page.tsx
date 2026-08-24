import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui";
import { fmtEuros, fmtPourcent, MOIS, MOIS_COURTS } from "@/lib/format";
import {
  anneesDisponibles,
  filtrerAffaires,
} from "@/lib/domain/commissions";
import { FiltresPeriode } from "../filtres-periode";
import { chargerApporteurs } from "@/lib/referentiels";
import type { Affaire, Profile } from "@/lib/domain/database.types";

export const metadata = { title: "Commissions — Capella CRM" };
export const dynamic = "force-dynamic";

type Recherche = {
  annee?: string;
  mois?: string;
  commercial?: string;
  apporteur?: string;
};

const TH =
  "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-300";

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const filtres = await searchParams;

  const supabase = await createClient();

  const [{ data: affairesBrutes }, { data: profils }, apporteurs] =
    await Promise.all([
      supabase
        .from("affaires")
        .select("commercial_id, apporteur_id, stage, date_signature, commission")
        .is("deleted_at", null),
      supabase.from("profiles").select("id, full_name, commission_rate"),
      chargerApporteurs(),
    ]);

  const toutesAffaires = (affairesBrutes ?? []) as Affaire[];
  const listeProfils = (profils ?? []) as Pick<
    Profile,
    "id" | "full_name" | "commission_rate"
  >[];
  const listeApporteurs = apporteurs;

  const annees = anneesDisponibles(toutesAffaires);
  const annee = Number(filtres.annee) || annees[0];
  const mois = Number(filtres.mois) || undefined;

  const affaires = filtrerAffaires(toutesAffaires, {
    annee,
    mois,
    commercialId: filtres.commercial,
    apporteurId: filtres.apporteur,
  }).filter((a) => a.stage === "Signé" && a.date_signature);

  // --- Commissions par commercial et par mois -------------------------
  type LigneCommercial = {
    id: string;
    nom: string;
    taux: number;
    parMois: number[]; // CA signé de chaque mois
    caTotal: number;
    nbTotal: number;
  };

  const parCommercial = new Map<string, LigneCommercial>();
  for (const p of listeProfils) {
    parCommercial.set(p.id, {
      id: p.id,
      nom: p.full_name,
      taux: Number(p.commission_rate),
      parMois: Array(12).fill(0),
      caTotal: 0,
      nbTotal: 0,
    });
  }

  for (const a of affaires) {
    const ligne = parCommercial.get(a.commercial_id);
    if (!ligne) continue;
    const m = new Date(a.date_signature!).getUTCMonth();
    if (new Date(a.date_signature!).getUTCFullYear() !== annee) continue;
    const montant = Number(a.commission ?? 0);
    ligne.parMois[m] += montant;
    ligne.caTotal += montant;
    ligne.nbTotal += 1;
  }

  const lignesCommerciaux = [...parCommercial.values()]
    .filter((l) => l.nbTotal > 0 || estAdmin)
    .sort((a, b) => b.caTotal - a.caTotal);

  const totalCa = lignesCommerciaux.reduce((s, l) => s + l.caTotal, 0);
  const totalCommissions = lignesCommerciaux.reduce(
    (s, l) => s + l.caTotal * l.taux,
    0,
  );
  const totalParMois = Array.from({ length: 12 }, (_, m) =>
    lignesCommerciaux.reduce((s, l) => s + l.parMois[m], 0),
  );

  // --- Commissions par apporteur --------------------------------------
  const parApporteur = listeApporteurs
    .map((ap) => {
      const siennes = affaires.filter((a) => a.apporteur_id === ap.id);
      const ca = siennes.reduce((s, a) => s + Number(a.commission ?? 0), 0);
      return {
        ...ap,
        nb: siennes.length,
        ca,
        du: ca * Number(ap.commission_rate),
      };
    })
    .filter((a) => a.nb > 0);

  const periode = mois ? `${MOIS[mois - 1]} ${annee}` : `Année ${annee}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold text-navy-800">
          Commissions
        </h1>
        <p className="mt-1 text-sm text-grey-brand">
          Calculées sur les affaires signées, rattachées au mois de leur date de
          signature. {periode}.
        </p>
      </header>

      <div className="mb-5">
        <FiltresPeriode
          chemin="/commissions"
          annees={annees}
          commerciaux={
            estAdmin
              ? listeProfils.map((p) => ({ value: p.id, label: p.full_name }))
              : []
          }
          apporteurs={
            estAdmin
              ? listeApporteurs.map((a) => ({ value: a.id, label: a.name }))
              : []
          }
        />
      </div>

      <Card className="mb-6 overflow-hidden">
        <CardHeader
          title={estAdmin ? "Par commercial" : "Ma commission"}
          hint={`CA signé mois par mois sur ${annee}, et commission due.`}
        />
        <div className="scroll-slim overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-sm">
            <thead className="bg-navy-800">
              <tr>
                <th className={TH}>Commercial</th>
                <th className={TH}>Taux</th>
                {MOIS_COURTS.map((m) => (
                  <th key={m} className={`${TH} text-right`}>
                    {m}
                  </th>
                ))}
                <th className={`${TH} text-right`}>CA signé</th>
                <th className={`${TH} text-right`}>Commission due</th>
              </tr>
            </thead>
            <tbody>
              {lignesCommerciaux.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-3 py-8 text-center text-sm text-grey-brand">
                    Aucune affaire signée sur cette période.
                  </td>
                </tr>
              ) : (
                lignesCommerciaux.map((l) => (
                  <tr key={l.id} className="border-b border-navy-100">
                    <td className="px-3 py-2 font-medium text-navy-800">{l.nom}</td>
                    <td className="tabular px-3 py-2 text-grey-brand">
                      {fmtPourcent(l.taux)}
                    </td>
                    {l.parMois.map((v, i) => (
                      <td
                        key={i}
                        className={
                          v > 0
                            ? "tabular px-3 py-2 text-right text-navy-800"
                            : "tabular px-3 py-2 text-right text-navy-200"
                        }
                      >
                        {v > 0 ? Math.round(v).toLocaleString("fr-FR") : "—"}
                      </td>
                    ))}
                    <td className="tabular px-3 py-2 text-right font-semibold text-navy-800">
                      {fmtEuros(l.caTotal)}
                    </td>
                    <td className="tabular px-3 py-2 text-right font-bold text-star-600">
                      {fmtEuros(l.caTotal * l.taux)}
                    </td>
                  </tr>
                ))
              )}

              {lignesCommerciaux.length > 0 ? (
                <tr className="bg-navy-800 font-bold text-white">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2" />
                  {totalParMois.map((v, i) => (
                    <td key={i} className="tabular px-3 py-2 text-right">
                      {v > 0 ? Math.round(v).toLocaleString("fr-FR") : "—"}
                    </td>
                  ))}
                  <td className="tabular px-3 py-2 text-right">{fmtEuros(totalCa)}</td>
                  <td className="tabular px-3 py-2 text-right">
                    {fmtEuros(totalCommissions)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="border-t border-navy-100 px-5 py-3 text-xs text-grey-brand">
          Les montants mensuels sont en euros, arrondis à l&apos;unité pour la
          lisibilité. Les totaux sont calculés sur les montants exacts.
        </p>
      </Card>

      {estAdmin ? (
        <Card className="overflow-hidden">
          <CardHeader
            title="Par apporteur d'affaires"
            hint="Ce que tu dois à tes apporteurs sur la période."
          />
          {parApporteur.length === 0 ? (
            <p className="px-5 py-6 text-sm text-grey-brand">
              Aucune affaire signée avec un apporteur sur cette période.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="bg-navy-800">
                <tr>
                  <th className={TH}>Apporteur</th>
                  <th className={TH}>Taux</th>
                  <th className={`${TH} text-right`}>Affaires</th>
                  <th className={`${TH} text-right`}>CA généré</th>
                  <th className={`${TH} text-right`}>Commission due</th>
                  <th className={TH}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {parApporteur.map((a) => (
                  <tr key={a.id} className="border-b border-navy-100">
                    <td className="px-3 py-2 font-medium text-navy-800">{a.name}</td>
                    <td className="tabular px-3 py-2 text-grey-brand">
                      {fmtPourcent(Number(a.commission_rate))}
                    </td>
                    <td className="tabular px-3 py-2 text-right">{a.nb}</td>
                    <td className="tabular px-3 py-2 text-right">{fmtEuros(a.ca)}</td>
                    <td className="tabular px-3 py-2 text-right font-bold text-star-600">
                      {fmtEuros(a.du)}
                    </td>
                    <td className="px-3 py-2">{a.payment_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : null}
    </main>
  );
}
