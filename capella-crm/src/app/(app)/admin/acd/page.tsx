import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateHeure } from "@/lib/format";

export const dynamic = "force-dynamic";

type LigneAcd = {
  id: string;
  ref: string | null;
  raison_sociale: string | null;
  nom: string | null;
  prenom: string | null;
  mail: string | null;
  tel_mobile: string | null;
  tel_fixe: string | null;
  last_action_at: string | null;
  acd_downloaded_at: string | null;
  assigned_to: string | null;
};

type Commercial = {
  id: string;
  full_name: string;
};

function libelleProspect(ligne: LigneAcd): string {
  if (ligne.raison_sociale?.trim()) return ligne.raison_sociale.trim();
  const personne = [ligne.prenom, ligne.nom].filter(Boolean).join(" ").trim();
  return personne || ligne.ref || "Prospect";
}

export default async function AcdATraiterPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data, error }, { data: profils }] = await Promise.all([
    supabase
      .from("prospects")
      .select("id, ref, raison_sociale, nom, prenom, mail, tel_mobile, tel_fixe, last_action_at, acd_downloaded_at, assigned_to")
      .eq("stage", "Demande ACD")
      .is("deleted_at", null)
      .order("last_action_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const lignes: LigneAcd[] = data ?? [];
  const commerciaux: Commercial[] = profils ?? [];
  const nomsCommerciaux = new Map(commerciaux.map((c) => [c.id, c.full_name]));

  const stats = new Map<string, { nom: string; total: number; telechargees: number }>();
  for (const ligne of lignes) {
    const cle = ligne.assigned_to || "sans-attribution";
    const nom = ligne.assigned_to
      ? nomsCommerciaux.get(ligne.assigned_to) || "Commercial inconnu"
      : "Sans attribution";
    const actuel = stats.get(cle) || { nom, total: 0, telechargees: 0 };
    actuel.total += 1;
    if (ligne.acd_downloaded_at) actuel.telechargees += 1;
    stats.set(cle, actuel);
  }

  const statsParCommercial = Array.from(stats.values()).sort((a, b) =>
    a.nom.localeCompare(b.nom, "fr"),
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-navy-800">ACD à traiter</h1>
      <p className="mt-1 text-sm text-grey-brand">
        Prospects en attente d&apos;une ACD. Seul l&apos;administrateur peut générer et télécharger le PDF.
      </p>

      {error ? (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Impossible de charger les demandes ACD : {error.message}
        </div>
      ) : null}

      {statsParCommercial.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statsParCommercial.map((stat) => (
            <div key={stat.nom} className="rounded-xl border border-navy-100 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-grey-brand">
                {stat.nom}
              </div>
              <div className="mt-2 flex items-end gap-4">
                <div>
                  <div className="text-2xl font-bold text-navy-800">{stat.total}</div>
                  <div className="text-xs text-grey-brand">demandes ACD</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-700">{stat.telechargees}</div>
                  <div className="text-xs text-grey-brand">téléchargées</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-xl border border-navy-100 bg-white">
        {lignes.length === 0 ? (
          <p className="p-5 text-sm text-grey-brand">Aucune ACD à traiter.</p>
        ) : (
          <div className="divide-y divide-navy-100">
            {lignes.map((ligne) => {
              const telephone = ligne.tel_mobile || ligne.tel_fixe;
              const detenteur = ligne.assigned_to
                ? nomsCommerciaux.get(ligne.assigned_to) || "Commercial inconnu"
                : "Sans attribution";

              return (
                <div key={ligne.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-navy-800">{libelleProspect(ligne)}</div>
                      {ligne.acd_downloaded_at ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                          ✓ Téléchargée
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          À traiter
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-grey-brand">
                      {ligne.ref || "Sans référence"}
                      {ligne.last_action_at ? ` · demande ${fmtDateHeure(ligne.last_action_at)}` : ""}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-grey-brand">
                      <span className="font-semibold text-navy-700">Détenteur : {detenteur}</span>
                      {ligne.mail ? <span>{ligne.mail}</span> : null}
                      {telephone ? <span>{telephone}</span> : null}
                      {ligne.acd_downloaded_at ? (
                        <span>téléchargée {fmtDateHeure(ligne.acd_downloaded_at)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/prospection/${ligne.id}`}
                      className="rounded-lg border border-navy-200 px-3 py-2 text-xs font-semibold text-navy-700"
                    >
                      Voir la fiche
                    </Link>
                    <a
                      href={`/api/acd/${ligne.id}/telecharger`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-star-500 px-3 py-2 text-xs font-semibold text-white hover:bg-star-600"
                    >
                      {ligne.acd_downloaded_at ? "Retélécharger l’ACD" : "Générer / télécharger l’ACD"}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
