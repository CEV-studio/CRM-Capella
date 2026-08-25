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

type Commercial = { id: string; full_name: string };

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
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const lignes: LigneAcd[] = data ?? [];
  const commerciaux: Commercial[] = profils ?? [];
  const nomsCommerciaux = new Map(commerciaux.map((c) => [c.id, c.full_name]));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-navy-800">ACD à traiter</h1>
      <p className="mt-1 text-sm text-grey-brand">
        Prospects en attente d&apos;une ACD. Seul l&apos;administrateur peut générer et télécharger le PDF.
      </p>

      {error ? (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Impossible de charger les demandes ACD : {error.message}
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-navy-100 bg-white">
        {lignes.length === 0 ? (
          <p className="p-5 text-sm text-grey-brand">Aucune ACD à traiter.</p>
        ) : (
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/60 text-xs font-semibold uppercase tracking-wide text-grey-brand">
              <tr>
                <th className="px-4 py-3">Prospect</th>
                <th className="px-4 py-3">Commercial</th>
                <th className="px-4 py-3">Demande</th>
                <th className="px-4 py-3">Statut ACD</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {lignes.map((ligne) => {
                const telephone = ligne.tel_mobile || ligne.tel_fixe;
                const detenteur = ligne.assigned_to
                  ? nomsCommerciaux.get(ligne.assigned_to) || "Commercial inconnu"
                  : "Sans attribution";

                return (
                  <tr key={ligne.id} className="align-middle">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-navy-800">{libelleProspect(ligne)}</div>
                      <div className="mt-0.5 text-xs text-grey-brand">{ligne.ref || "Sans référence"}</div>
                      <div className="mt-1 text-xs text-grey-brand">
                        {[ligne.mail, telephone].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-navy-700">{detenteur}</td>
                    <td className="px-4 py-4 text-xs text-grey-brand">
                      {ligne.last_action_at ? fmtDateHeure(ligne.last_action_at) : "—"}
                    </td>
                    <td className="px-4 py-4">
                      {ligne.acd_downloaded_at ? (
                        <div>
                          <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-800">✓ Téléchargée</span>
                          <div className="mt-1 text-[11px] text-grey-brand">{fmtDateHeure(ligne.acd_downloaded_at)}</div>
                        </div>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">À traiter</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Link href={`/prospection/${ligne.id}`} className="rounded-lg border border-navy-200 px-3 py-2 text-xs font-semibold text-navy-700">Voir la fiche</Link>
                        <a href={`/api/acd/${ligne.id}/telecharger`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-star-500 px-3 py-2 text-xs font-semibold text-white hover:bg-star-600">
                          {ligne.acd_downloaded_at ? "Retélécharger" : "Télécharger l’ACD"}
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
