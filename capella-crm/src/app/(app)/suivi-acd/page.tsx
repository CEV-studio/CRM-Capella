import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateHeure } from "@/lib/format";

export const dynamic = "force-dynamic";
type RequestRow = { id: string; raison_sociale: string; status: string; submitted_at: string; processed_at: string | null };
const statusLabel: Record<string, string> = {
  a_traiter: "Transmise à l’ADV",
  en_cours: "Traitement en cours",
  envoyee: "ACD envoyée — en attente de signature",
  terminee: "ACD signée",
  annulee: "Demande annulée",
};
const statusStyle: Record<string, string> = {
  a_traiter: "bg-amber-50 text-amber-800",
  en_cours: "bg-sky-capella-50 text-sky-capella-700",
  envoyee: "bg-violet-100 text-violet-800",
  terminee: "bg-emerald-50 text-emerald-800",
  annulee: "bg-rose-100 text-rose-800",
};

export default async function SuiviAcdPage() {
  await requireProfile();
  const supabase = await createClient();
  // La RLS limite ces lignes aux demandes créées par l’utilisateur ou à ses dossiers attribués.
  const { data, error } = await (supabase as any)
    .from("acd_requests")
    .select("id, raison_sociale, status, submitted_at, processed_at")
    .order("submitted_at", { ascending: false });
  const rows = (data ?? []) as RequestRow[];

  return <main className="mx-auto w-full max-w-6xl px-6 py-8">
    <header className="mb-6">
      <h1 className="font-display text-2xl font-bold text-navy-900">Suivi des demandes d’ACD</h1>
      <p className="mt-1 text-sm text-grey-brand">Retrouvez les étapes de traitement de vos demandes transmises à l’ADV.</p>
    </header>
    {error ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Impossible de charger le suivi des demandes pour le moment.</div> : null}
    {rows.length === 0 ? <div className="rounded-2xl border border-navy-100 bg-white p-6 text-sm text-grey-brand">Aucune demande d’ACD à afficher.</div> :
      <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-[var(--crm-shadow-sm)]">
        <div className="grid grid-cols-[minmax(0,1fr)_190px_170px] gap-4 border-b border-navy-100 bg-navy-50/70 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-grey-brand">
          <span>Entreprise</span><span>Étape</span><span>Dernière mise à jour</span>
        </div>
        <div className="divide-y divide-navy-100">
          {rows.map(row => <article key={row.id} className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_190px_170px] sm:items-center sm:gap-4">
            <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-navy-900">{row.raison_sociale}</h2><p className="mt-1 text-xs text-grey-brand">Demande transmise le {fmtDateHeure(row.submitted_at)}</p></div>
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyle[row.status] ?? "bg-navy-100 text-navy-700"}`}>{statusLabel[row.status] ?? "Statut inconnu"}</span>
            <time className="text-xs text-grey-brand">{fmtDateHeure(row.processed_at ?? row.submitted_at)}</time>
          </article>)}
        </div>
      </div>}
  </main>;
}
