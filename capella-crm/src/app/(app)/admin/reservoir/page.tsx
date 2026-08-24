import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./import-form";
import {
  AttributionParSource,
  NouveauChampPerso,
  NouvelleSource,
  Reattribution,
  TableauReservoir,
  type LeadReservoir,
} from "./attribution";
import { chargerSources, chargerChampsPersonnalises } from "@/lib/referentiels";
import type { Prospect } from "@/lib/domain/database.types";

export const metadata = { title: "Réservoir — Capella CRM" };
export const dynamic = "force-dynamic";

/** Nombre de leads du réservoir affichés ligne à ligne. */
const APERCU = 200;

export default async function ReservoirPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [
    { data: leadsBruts, count: totalReservoir },
    sources,
    { data: profils },
    { data: parSource },
    champsPerso,
  ] = await Promise.all([
    supabase
      .from("prospects")
      .select("*", { count: "exact" })
      .is("assigned_to", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(APERCU),
    chargerSources(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name"),
    // Sert uniquement à compter les leads disponibles par source.
    supabase.from("prospects").select("source_id").is("assigned_to", null).is("deleted_at", null),
    chargerChampsPersonnalises(),
  ]);

  const listeSources = sources;
  const nomParSource = new Map(listeSources.map((s) => [s.id, s.name]));

  const disponiblesParSource = new Map<string, number>();
  for (const p of (parSource ?? []) as { source_id: string | null }[]) {
    if (!p.source_id) continue;
    disponiblesParSource.set(
      p.source_id,
      (disponiblesParSource.get(p.source_id) ?? 0) + 1,
    );
  }

  const leads: LeadReservoir[] = ((leadsBruts ?? []) as Prospect[]).map((l) => ({
    ...l,
    source: l.source_id ? (nomParSource.get(l.source_id) ?? null) : null,
  }));

  const commerciaux = (profils ?? []).map((p) => ({
    value: p.id,
    label: p.full_name,
  }));

  const sansSource = (parSource ?? []).filter(
    (p) => !(p as { source_id: string | null }).source_id,
  ).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-navy-800">
          Réservoir &amp; attribution
        </h1>
        <p className="mt-1 text-sm text-grey-brand">
          Tes leads bruts, en attente. Aucun commercial ne les voit tant que tu
          ne les as pas attribués — et un lead attribué ne peut pas se retrouver
          chez deux personnes.
        </p>
      </header>

      <div className="space-y-6">
        <ImportForm
          sources={listeSources
            .filter((s) => s.is_active)
            .map((s) => ({ value: s.id, label: s.name }))}
          commerciaux={commerciaux}
          champsPerso={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))}
        />

        <NouvelleSource />

        <NouveauChampPerso
          champs={champsPerso.map((c) => ({ cle: c.cle, libelle: c.libelle }))}
        />

        <AttributionParSource
          sources={listeSources
            .filter((s) => s.is_active)
            .map((s) => ({
              value: s.id,
              label: s.name,
              disponibles: disponiblesParSource.get(s.id) ?? 0,
            }))}
          commerciaux={commerciaux}
        />

        <TableauReservoir
          leads={leads}
          commerciaux={commerciaux}
          total={totalReservoir ?? 0}
        />

        {(totalReservoir ?? 0) > APERCU ? (
          <p className="text-xs text-grey-brand">
            Les {APERCU} leads les plus récents sont affichés ligne à ligne.
            Pour les autres, utilise l&apos;attribution par lot ci-dessus.
          </p>
        ) : null}

        {sansSource > 0 ? (
          <p
            className="rounded-lg px-3 py-2 text-sm text-navy-800"
            style={{ backgroundColor: "var(--color-status-relance)" }}
          >
            {sansSource} lead(s) du réservoir n&apos;ont pas de source. Tu ne
            pourras pas les attribuer par lot, ni savoir plus tard d&apos;où ils
            viennent. Ouvre leur fiche pour la renseigner.
          </p>
        ) : null}

        <Reattribution commerciaux={commerciaux} />
      </div>
    </main>
  );
}
