import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KpiTile } from "@/components/ui";
import { AFFAIRE_STAGES, stageColor } from "@/lib/domain/stages";
import { fmtEuros } from "@/lib/format";
import { Carte, type CarteAffaire } from "./carte";
import { chargerApporteurs } from "@/lib/referentiels";
import type { Affaire, Profile } from "@/lib/domain/database.types";

export const metadata = { title: "Conversion — Capella CRM" };
export const dynamic = "force-dynamic";

/** Au-delà, la colonne affiche un compteur plutôt que toutes les cartes. */
const CARTES_PAR_COLONNE = 40;

export default async function ConversionPage() {
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";

  const supabase = await createClient();

  const [{ data: affairesBrutes, error }, { data: profils }, apporteurs] =
    await Promise.all([
      supabase
        .from("affaires")
        // Le kanban n'a pas besoin des champs de la fiche complète (ACD,
        // facture, adresse, notes…). Ils sont lus uniquement sur la fiche.
        .select(
          "id, ref, commercial_id, apporteur_id, raison_sociale, type_energie, stage, date_signature, date_relance, commission",
        )
        .is("deleted_at", null)
        .order("date_entree", { ascending: false }),
      estAdmin
        ? supabase.from("profiles").select("id, full_name")
        : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[] }),
      chargerApporteurs(),
    ]);

  const nomCommercial = new Map(
    ((profils ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );
  const nomApporteur = new Map(apporteurs.map((a) => [a.id, a.name]));

  const affaires: CarteAffaire[] = ((affairesBrutes ?? []) as Affaire[]).map((a) => ({
    ...a,
    commercial: nomCommercial.get(a.commercial_id) ?? null,
    apporteur: a.apporteur_id ? (nomApporteur.get(a.apporteur_id) ?? null) : null,
  }));

  const parEtape = new Map<string, CarteAffaire[]>(
    AFFAIRE_STAGES.map((s) => [s.label as string, []]),
  );
  for (const a of affaires) parEtape.get(a.stage)?.push(a);

  // --- Quelques repères en haut d'écran -------------------------------
  const signees = affaires.filter((a) => a.stage === "Signé");
  const caSigne = signees.reduce((s, a) => s + Number(a.commission ?? 0), 0);
  const enCours = affaires.filter((a) => a.stage !== "Signé" && a.stage !== "KO");
  const tauxConversion =
    affaires.length > 0 ? signees.length / affaires.length : 0;

  return (
    <main className="w-full px-6 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800">
            Conversion
          </h1>
          <p className="mt-1 text-sm text-grey-brand">
            {estAdmin
              ? "Toutes les affaires en cours de signature."
              : "Tes affaires. Change une étape depuis la carte."}
          </p>
        </div>
        <Link
          href="/conversion/nouvelle"
          className="inline-flex h-10 items-center rounded-lg bg-star-500 px-4 text-sm font-semibold text-white hover:bg-star-600"
        >
          Nouvelle affaire
        </Link>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Affaires signées" value={String(signees.length)} />
        <KpiTile label="CA signé" value={fmtEuros(caSigne)} hint="Somme des commissions" />
        <KpiTile label="En cours" value={String(enCours.length)} hint="Ni signées ni perdues" />
        <KpiTile
          label="Taux de conversion"
          value={`${(tauxConversion * 100).toFixed(1).replace(".", ",")} %`}
        />
      </div>

      {error ? (
        <p className="text-sm text-navy-800">Lecture impossible : {error.message}</p>
      ) : null}

      {/* Pipeline en colonnes. Pas de glisser-déposer en V1 : le changement
          d'étape se fait par la pastille de chaque carte. */}
      <div className="scroll-slim overflow-x-auto pb-3">
        <div className="flex min-w-max gap-4">
          {AFFAIRE_STAGES.map((etape) => {
            const cartes = parEtape.get(etape.label) ?? [];
            const total = cartes.reduce((s, a) => s + Number(a.commission ?? 0), 0);

            return (
              <section key={etape.label} className="w-64 shrink-0">
                <header
                  className="flex items-center justify-between rounded-t-lg px-3 py-2"
                  style={{ backgroundColor: stageColor(etape.label, "affaire") }}
                >
                  <h2 className="text-sm font-semibold text-navy-800">
                    {etape.label}
                  </h2>
                  <span className="tabular rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-navy-800">
                    {cartes.length}
                  </span>
                </header>

                {total > 0 ? (
                  <div className="tabular border-x border-navy-100 bg-white px-3 py-1.5 text-[11px] font-semibold text-grey-brand">
                    {fmtEuros(total)}
                  </div>
                ) : null}

                <ul className="min-h-24 space-y-2 rounded-b-lg border border-navy-100 bg-navy-50 p-2">
                  {cartes.length === 0 ? (
                    <li className="px-2 py-6 text-center text-xs text-grey-brand">
                      Aucune affaire
                    </li>
                  ) : (
                    <>
                      {cartes.slice(0, CARTES_PAR_COLONNE).map((a) => (
                        <Carte key={a.id} a={a} afficherCommercial={estAdmin} />
                      ))}
                      {cartes.length > CARTES_PAR_COLONNE ? (
                        <li className="px-2 py-2 text-center text-xs text-grey-brand">
                          + {cartes.length - CARTES_PAR_COLONNE} autre(s)
                        </li>
                      ) : null}
                    </>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-grey-brand">
        Passer une affaire à « Signé » remplit la date de signature
        automatiquement si elle est vide.
      </p>
    </main>
  );
}
