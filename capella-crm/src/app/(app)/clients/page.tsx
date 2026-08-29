import Link from "next/link";
import { Clock3 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_STAGES, stageColor } from "@/lib/domain/stages";

export const metadata = { title: "Dossiers en cours — Capella CRM" };
export const dynamic = "force-dynamic";

type Recherche = { vue?: string };

type Row = {
  id: string;
  ref: string | null;
  raison_sociale: string | null;
  nom: string | null;
  prenom: string | null;
  stage: string;
  became_client_at: string | null;
};

function libelle(c: Row) {
  return c.raison_sociale || [c.prenom, c.nom].filter(Boolean).join(" ") || "Client sans nom";
}

function acdDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(",", " à");
}

function acdAge(value: string | null) {
  if (!value) return null;
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `il y a ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} jour${days > 1 ? "s" : ""}`;
}

function ACDMeta({ value, compact = false }: { value: string | null; compact?: boolean }) {
  const date = acdDate(value);
  const age = acdAge(value);
  if (!date) return null;
  return <div className={`mt-2 flex items-start gap-1.5 ${compact ? "text-[10px]" : "text-xs"} text-star-700`}><Clock3 size={compact ? 11 : 13} className="mt-0.5 shrink-0"/><span><strong>Demande ACD</strong> · {date}<span className="ml-1 font-semibold">({age})</span></span></div>;
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Recherche> }) {
  await requireProfile();
  const filtres = await searchParams;
  const supabase = await createClient();
  const db: any = supabase;

  const etapes = CLIENT_STAGES.filter((s) => s.label !== "Demande de cotation");
  const labels = etapes.map((s) => s.label);

  const resultat: any = await db
    .from("prospects")
    .select("id, ref, raison_sociale, nom, prenom, stage, became_client_at")
    .is("deleted_at", null)
    .not("became_client_at", "is", null)
    .is("entered_conversion_at", null)
    .in("stage", labels)
    .order("became_client_at", { ascending: true });

  const clients = (resultat?.data ?? []) as Row[];
  const erreur = resultat?.error?.message as string | undefined;
  const kanban = filtres.vue === "kanban";

  return (
    <main className="w-full px-6 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800">Dossiers en cours</h1>
          <p className="mt-1 text-sm text-grey-brand">Deuxième partie de la prospection : de la demande ACD jusqu’au passage en cotation.</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-navy-200 p-0.5">
            <Link href="/clients?vue=liste" className={!kanban ? "rounded-md bg-navy-800 px-3 py-1.5 text-sm font-semibold text-white" : "rounded-md px-3 py-1.5 text-sm font-semibold text-navy-700"}>Liste</Link>
            <Link href="/clients?vue=kanban" className={kanban ? "rounded-md bg-navy-800 px-3 py-1.5 text-sm font-semibold text-white" : "rounded-md px-3 py-1.5 text-sm font-semibold text-navy-700"}>Kanban</Link>
          </div>
          <Link href="/conversion" className="inline-flex h-10 items-center rounded-lg border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-700">Mes cotations</Link>
        </div>
      </header>

      {erreur ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Lecture impossible : {erreur}</div>
      ) : kanban ? (
        <div className="scroll-slim overflow-x-auto pb-3">
          <div className="flex min-w-max gap-4">
            {etapes.map((etape) => {
              const cartes = clients.filter((c) => c.stage === etape.label);
              return (
                <section key={etape.label} className="w-80 shrink-0">
                  <header className="flex items-center justify-between rounded-t-lg px-3 py-2" style={{ backgroundColor: stageColor(etape.label, "prospect") }}>
                    <h2 className="text-sm font-semibold text-navy-800">{etape.label}</h2>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-navy-800">{cartes.length}</span>
                  </header>
                  <div className="min-h-24 space-y-2 rounded-b-lg border border-navy-100 bg-navy-50 p-2">
                    {cartes.length === 0 ? <div className="px-2 py-6 text-center text-xs text-grey-brand">Aucun dossier</div> : cartes.map((c) => (
                      <Link key={c.id} href={`/prospection/${c.id}`} className="block rounded-lg border border-navy-100 bg-white p-3 shadow-sm hover:border-star-300">
                        <div className="truncate text-sm font-semibold text-navy-800">{libelle(c)}</div>
                        <div className="mt-1 text-[11px] text-grey-brand">{c.ref ?? ""}</div>
                        <ACDMeta value={c.became_client_at} compact />
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
          {clients.length === 0 ? (
            <div className="p-10 text-center text-sm text-grey-brand">Aucun dossier en cours.</div>
          ) : (
            <div className="divide-y divide-navy-100">
              {clients.map((c) => (
                <Link key={c.id} href={`/prospection/${c.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-navy-50">
                  <div className="min-w-0">
                    <div className="font-semibold text-navy-800">{libelle(c)}</div>
                    <div className="text-xs text-grey-brand">{c.ref ?? ""}</div>
                    <ACDMeta value={c.became_client_at} />
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-navy-800" style={{ backgroundColor: stageColor(c.stage, "prospect") }}>{c.stage}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
