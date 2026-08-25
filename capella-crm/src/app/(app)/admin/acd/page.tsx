import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateHeure } from "@/lib/format";

export const dynamic = "force-dynamic";

type LigneAcd = {
  id: string;
  file_name: string;
  created_at: string;
  prospect_id: string | null;
  prospects: { raison_sociale: string | null; ref: string } | null;
};

export default async function AcdATraiterPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("pieces_jointes")
    .select("id, file_name, created_at, prospect_id, prospects(raison_sociale, ref)")
    .eq("type", "ACD")
    .not("prospect_id", "is", null)
    .order("created_at", { ascending: false });

  const lignes = (data ?? []) as unknown as LigneAcd[];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-navy-800">ACD à traiter</h1>
      <p className="mt-1 text-sm text-grey-brand">Demandes générées par les commerciaux. Télécharge l’ACD puis dépose-la manuellement dans Yousign.</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-navy-100 bg-white">
        {lignes.length === 0 ? <p className="p-5 text-sm text-grey-brand">Aucune ACD à traiter.</p> : (
          <div className="divide-y divide-navy-100">
            {lignes.map((ligne) => (
              <div key={ligne.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold text-navy-800">{ligne.prospects?.raison_sociale || ligne.prospects?.ref || "Prospect"}</div>
                  <div className="mt-0.5 text-xs text-grey-brand">{ligne.prospects?.ref} · demandée {fmtDateHeure(ligne.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {ligne.prospect_id ? <Link href={`/prospection/${ligne.prospect_id}`} className="rounded-lg border border-navy-200 px-3 py-2 text-xs font-semibold text-navy-700">Voir la fiche</Link> : null}
                  <a href={`/pieces/${ligne.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-star-500 px-3 py-2 text-xs font-semibold text-white hover:bg-star-600">Télécharger l’ACD</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
