import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateHeure } from "@/lib/format";

export const dynamic = "force-dynamic";

type LigneAcd = {
  id: string;
  ref: string;
  raison_sociale: string | null;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  last_action_at: string | null;
};

function libelleProspect(ligne: LigneAcd): string {
  if (ligne.raison_sociale?.trim()) return ligne.raison_sociale.trim();
  const personne = [ligne.prenom, ligne.nom].filter(Boolean).join(" ").trim();
  return personne || ligne.ref;
}

export default async function AcdATraiterPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prospects")
    .select("id, ref, raison_sociale, nom, prenom, email, telephone, last_action_at")
    .eq("stage", "Demande ACD")
    .is("deleted_at", null)
    .order("last_action_at", { ascending: false });

  const lignes: LigneAcd[] = (data ?? []).map((ligne) => ({
    id: ligne.id,
    ref: ligne.ref,
    raison_sociale: ligne.raison_sociale,
    nom: ligne.nom,
    prenom: ligne.prenom,
    email: ligne.email,
    telephone: ligne.telephone,
    last_action_at: ligne.last_action_at,
  }));

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

      <div className="mt-6 overflow-hidden rounded-xl border border-navy-100 bg-white">
        {lignes.length === 0 ? (
          <p className="p-5 text-sm text-grey-brand">Aucune ACD à traiter.</p>
        ) : (
          <div className="divide-y divide-navy-100">
            {lignes.map((ligne) => (
              <div key={ligne.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-semibold text-navy-800">{libelleProspect(ligne)}</div>
                  <div className="mt-0.5 text-xs text-grey-brand">
                    {ligne.ref}
                    {ligne.last_action_at ? ` · demande ${fmtDateHeure(ligne.last_action_at)}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-grey-brand">
                    {ligne.email ? <span>{ligne.email}</span> : null}
                    {ligne.telephone ? <span>{ligne.telephone}</span> : null}
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
                    href={`/api/acd/${ligne.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-star-500 px-3 py-2 text-xs font-semibold text-white hover:bg-star-600"
                  >
                    Générer / télécharger l&apos;ACD
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
