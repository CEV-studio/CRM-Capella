import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, KpiTile, StageBadge } from "@/components/ui";
import { AFFAIRE_STAGES, PROSPECT_STAGES, stageColor } from "@/lib/domain/stages";
import { fmtEuros, fmtNombre, fmtPourcent, MOIS } from "@/lib/format";
import {
  anneesDisponibles,
  calculerIndicateurs,
  commissionsParMois,
  filtrerAffaires,
} from "@/lib/domain/commissions";
import { FiltresPeriode } from "./filtres-periode";
import { chargerApporteurs } from "@/lib/referentiels";
import type { Affaire, Profile, Prospect } from "@/lib/domain/database.types";

export const metadata = { title: "Tableau de bord — Capella CRM" };
export const dynamic = "force-dynamic";

type Recherche = {
  annee?: string;
  mois?: string;
  commercial?: string;
  apporteur?: string;
};

export default async function TableauDeBordPage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const filtres = await searchParams;

  const supabase = await createClient();

  const [
    { data: affairesBrutes },
    { data: prospectsBruts },
    { data: profils },
    apporteurs,
  ] = await Promise.all([
    supabase
      .from("affaires")
      .select("commercial_id, apporteur_id, stage, date_signature, date_relance, commission")
      .is("deleted_at", null),
    supabase.from("prospects").select("stage, next_action_date").is("deleted_at", null),
    supabase.from("profiles").select("id, full_name, commission_rate"),
    chargerApporteurs(),
  ]);

  const toutesAffaires = (affairesBrutes ?? []) as Affaire[];
  const listeProfils = (profils ?? []) as Pick<
    Profile,
    "id" | "full_name" | "commission_rate"
  >[];
  const listeApporteurs = apporteurs;

  const tauxCommercial = new Map(
    listeProfils.map((p) => [p.id, Number(p.commission_rate)]),
  );
  const tauxApporteur = new Map(
    listeApporteurs.map((a) => [a.id, Number(a.commission_rate)]),
  );

  const annees = anneesDisponibles(toutesAffaires);
  const annee = Number(filtres.annee) || annees[0];
  const mois = Number(filtres.mois) || undefined;

  const affaires = filtrerAffaires(toutesAffaires, {
    annee,
    mois,
    commercialId: filtres.commercial,
    apporteurId: filtres.apporteur,
  });

  const kpi = calculerIndicateurs(affaires, tauxCommercial, tauxApporteur);
  const parMois = commissionsParMois(affaires, annee, tauxCommercial);
  const totalMois = parMois.reduce(
    (t, l) => ({
      nb: t.nb + l.nbSignees,
      ca: t.ca + l.caSigne,
      com: t.com + l.commissions,
    }),
    { nb: 0, ca: 0, com: 0 },
  );

  const affairesParEtape = new Map<string, number>();
  for (const a of affaires) {
    affairesParEtape.set(a.stage, (affairesParEtape.get(a.stage) ?? 0) + 1);
  }

  const prospects = (prospectsBruts ?? []) as Pick<
    Prospect,
    "stage" | "next_action_date"
  >[];
  const prospectsParEtape = new Map<string, number>();
  for (const p of prospects) {
    prospectsParEtape.set(p.stage, (prospectsParEtape.get(p.stage) ?? 0) + 1);
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const relancesProspection = prospects.filter(
    (p) => p.next_action_date != null && p.next_action_date >= aujourdhui,
  ).length;

  const periode = mois ? `${MOIS[mois - 1]} ${annee}` : `Année ${annee}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold text-navy-800">
          Bonjour {profil.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-grey-brand">
          {estAdmin
            ? "Vue d'ensemble de Capella Energy."
            : "Ton activité. Tu ne vois que tes propres chiffres."}
        </p>
      </header>

      <div className="mb-5">
        <FiltresPeriode
          chemin="/"
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiTile label="CA signé" value={fmtEuros(kpi.caSigne)} hint={periode} />
        <KpiTile label="Affaires signées" value={fmtNombre(kpi.nbSignees)} hint={periode} />
        <KpiTile
          label="Taux de conversion"
          value={fmtPourcent(kpi.tauxConversion)}
          hint="Signées sur affaires suivies"
        />
        <KpiTile
          label="Affaires en cours"
          value={fmtNombre(kpi.nbEnCours)}
          hint="Ni signées ni perdues"
        />
        <KpiTile
          label={estAdmin ? "Commissions commerciaux signées" : "Ma commission signée"}
          value={fmtEuros(kpi.commissionsCommerciaux)}
          hint="Comptabilisée uniquement sur les dossiers signés"
        />
        <KpiTile
          label={estAdmin ? "Commission Capella en attente" : "Ma commission en attente"}
          value={fmtEuros(estAdmin ? kpi.caEnAttente : kpi.commissionsCommerciauxEnAttente)}
          hint={estAdmin ? "Commission globale déjà renseignée sur dossiers non signés" : "Déjà renseignée par l’ADV, en attente de signature"}
        />
        <KpiTile
          label="Relances à venir"
          value={fmtNombre(kpi.relancesAVenir + relancesProspection)}
          hint={`${kpi.relancesAVenir} en conversion · ${relancesProspection} en prospection`}
        />
      </div>

      <Card className="mb-6 overflow-hidden">
        <CardHeader
          title={`Commissions par mois — ${annee}`}
          hint="Une affaire est rattachée au mois de sa date de signature."
          action={
            <Link
              href="/commissions"
              className="text-sm font-semibold text-star-600 underline underline-offset-2"
            >
              Détail par commercial →
            </Link>
          }
        />
        <div className="scroll-slim overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead className="bg-navy-800">
              <tr>
                {["Mois", "Affaires signées", "CA signé", "Commissions"].map((t) => (
                  <th
                    key={t}
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-300"
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parMois.map((l) => (
                <tr
                  key={l.mois}
                  className={
                    l.nbSignees > 0
                      ? "border-b border-navy-100"
                      : "border-b border-navy-100 text-navy-300"
                  }
                >
                  <td className="px-4 py-1.5">{MOIS[l.mois - 1]}</td>
                  <td className="tabular px-4 py-1.5">{l.nbSignees}</td>
                  <td className="tabular px-4 py-1.5">{fmtEuros(l.caSigne)}</td>
                  <td className="tabular px-4 py-1.5">{fmtEuros(l.commissions)}</td>
                </tr>
              ))}
              <tr className="bg-navy-800 font-bold text-white">
                <td className="px-4 py-2">Total</td>
                <td className="tabular px-4 py-2">{totalMois.nb}</td>
                <td className="tabular px-4 py-2">{fmtEuros(totalMois.ca)}</td>
                <td className="tabular px-4 py-2">{fmtEuros(totalMois.com)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Conversion par étape" hint={periode} />
          <ul className="divide-y divide-navy-100">
            {AFFAIRE_STAGES.map((s) => (
              <li key={s.label} className="flex items-center justify-between px-5 py-2">
                <StageBadge label={s.label} color={stageColor(s.label, "affaire")} />
                <span className="tabular text-sm font-semibold text-navy-800">
                  {affairesParEtape.get(s.label) ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Prospection par étape"
            hint="Non filtré par période : un prospect n'a pas de date de signature."
          />
          <ul className="divide-y divide-navy-100">
            {PROSPECT_STAGES.map((s) => (
              <li key={s.label} className="flex items-center justify-between px-5 py-1.5">
                <StageBadge label={s.label} color={stageColor(s.label, "prospect")} />
                <span className="tabular text-sm font-semibold text-navy-800">
                  {prospectsParEtape.get(s.label) ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
