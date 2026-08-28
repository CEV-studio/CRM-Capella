import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CLIENT_STAGES, stageColor } from "@/lib/domain/stages";
import { fmtDate } from "@/lib/format";
import type { Profile } from "@/lib/domain/database.types";

export const metadata = { title: "Clients — Capella CRM" };
export const dynamic = "force-dynamic";

type Recherche = { q?: string; etape?: string; commercial?: string; vue?: string };

type ClientRow = {
  id: string;
  ref: string | null;
  raison_sociale: string | null;
  nom: string | null;
  prenom: string | null;
  mail: string | null;
  tel_mobile: string | null;
  tel_fixe: string | null;
  siren: string | null;
  stage: string;
  next_action: string | null;
  next_action_date: string | null;
  assigned_to: string | null;
  became_client_at: string | null;
  ko_reason: string | null;
};

type ClientAvecCommercial = ClientRow & { commercial: string };

function nomClient(c: ClientRow) {
  return c.raison_sociale || [c.prenom, c.nom].filter(Boolean).join(" ") || "Client sans nom";
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Recherche> }) {
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const filtres = await searchParams;
  const supabase = await createClient();
  const db: any = supabase;

  const etapesClients = CLIENT_STAGES.map((s) => s.label).filter((s) => s !== "Demande de cotation");
  const vuesEtapes = CLIENT_STAGES.filter((s) => s.label !== "Demande de cotation");

  let requete: any = db
    .from("prospects")
    .select("id, ref, raison_sociale, nom, prenom, mail, tel_mobile, tel_fixe, siren, stage, next_action, next_action_date, assigned_to, became_client_at, ko_reason")
    .is("deleted_at", null)
    .not("became_client_at", "is", null)
    .is("entered_conversion_at", null)
    .in("stage", etapesClients)
    .order("became_client_at", { ascending: false });

  const q = (filtres.q ?? "").trim();
  if (q) {
    const safe = q.split(",").join(" ");
    requete = requete.or(`raison_sociale.ilike.%${safe}%,nom.ilike.%${safe}%,prenom.ilike.%${safe}%,mail.ilike.%${safe}%`);
  }
  if (filtres.etape && etapesClients.includes(filtres.etape)) requete = requete.eq("stage", filtres.etape);
  if (estAdmin && filtres.commercial) {
    requete = filtres.commercial === "reservoir" ? requete.is("assigned_to", null) : requete.eq("assigned_to", filtres.commercial);
  }

  const resultatClients = await requete;
  const profilsResult = estAdmin
    ? await supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name")
    : { data: [] as Pick<Profile, "id" | "full_name">[] };

  const data = (resultatClients?.data ?? []) as ClientRow[];
  const error = resultatClients?.error as { message?: string } | null | undefined;
  const profils = (profilsResult.data ?? []) as Pick<Profile, "id" | "full_name">[];
  const noms = new Map<string, string>(profils.map((p) => [p.id, p.full_name]));
  const clients: ClientAvecCommercial[] = data.map((c) => ({
    ...c,
    commercial: c.assigned_to ? noms.get(c.assigned_to) ?? "—" : "Réservoir",
  }));

  const kanban = filtres.vue === "kanban";
  const total = clients.length;

  function url(changes: Record<string, string | null>) {
    const p = new URLSearchParams();
    if (filtres.q) p.set("q", filtres.q);
    if (filtres.etape) p.set("etape", filtres.etape);
    if (filtres.commercial) p.set("commercial", filtres.commercial);
    if (filtres.vue) p.set("vue", filtres.vue);
    for (const [k, v] of Object.entries(changes)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/clients?${p.toString()}`;
  }

  return (
    <main className="w-full px-6 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800">Clients</h1>
          <p className="mt-1 text-sm text-grey-brand">À partir de Demande ACD, jusqu’au passage en Demande de cotation.</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-navy-200 p-0.5">
            <Link href={url({ vue: "liste" })} className={!kanban ? "rounded-md bg-navy-800 px-3 py-1.5 text-sm font-semibold text-white" : "rounded-md px-3 py-1.5 text-sm font-semibold text-navy-700"}>Liste</Link>
            <Link href={url({ vue: "kanban" })} className={kanban ? "rounded-md bg-navy-800 px-3 py-1.5 text-sm font-semibold text-white" : "rounded-md px-3 py-1.5 text-sm font-semibold text-navy-700"}>Kanban</Link>
          </div>
          <Link href="/conversion" className="inline-flex h-10 items-center rounded-lg border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-700">Voir les cotations</Link>
        </div>
      </header>

      <form method="get" className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-navy-100 bg-white p-3">
        <input type="search" name="q" defaultValue={filtres.q ?? ""} placeholder="Rechercher un client…" className="h-9 min-w-64 flex-1 rounded-lg border border-navy-200 px-3 text-sm" />
        <select name="etape" defaultValue={filtres.etape ?? ""} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm">
          <option value="">Toutes les étapes</option>
          {vuesEtapes.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
        </select>
        {estAdmin ? (
          <select name="commercial" defaultValue={filtres.commercial ?? ""} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm">
            <option value="">Tous les commerciaux</option>
            <option value="reservoir">Réservoir</option>
            {profils.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        ) : null}
        <input type="hidden" name="vue" value={kanban ? "kanban" : "liste"} />
        <button className="h-9 rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white">Filtrer</button>
        <span className="ml-auto text-xs text-grey-brand">{total} client{total > 1 ? "s" : ""}</span>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Lecture impossible : {error.message ?? "Erreur inconnue"}</div>
      ) : kanban ? (
        <div className="scroll-slim overflow-x-auto pb-3"><div className="flex min-w-max gap-4">
          {vuesEtapes.map((etape) => {
            const cartes = clients.filter((c) => c.stage === etape.label);
            return <section key={etape.label} className="w-72 shrink-0">
              <header className="flex items-center justify-between rounded-t-lg px-3 py-2" style={{ backgroundColor: stageColor(etape.label, "prospect") }}><h2 className="text-sm font-semibold text-navy-800">{etape.label}</h2><span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-navy-800">{cartes.length}</span></header>
              <div className="min-h-24 space-y-2 rounded-b-lg border border-navy-100 bg-navy-50 p-2">
                {cartes.length === 0 ? <div className="px-2 py-6 text-center text-xs text-grey-brand">Aucun client</div> : cartes.map((c) => <Link key={c.id} href={`/prospection/${c.id}`} className="block rounded-lg border border-navy-100 bg-white p-3 shadow-sm hover:border-star-300"><div className="truncate text-sm font-semibold text-navy-800">{nomClient(c)}</div><div className="mt-0.5 text-[11px] text-grey-brand">{c.ref}{c.siren ? ` · ${c.siren}` : ""}</div>{c.next_action || c.next_action_date ? <div className="mt-2 text-[11px] text-navy-700">{c.next_action ?? ""}{c.next_action_date ? ` · ${fmtDate(c.next_action_date)}` : ""}</div> : null}{estAdmin ? <div className="mt-2 text-[11px] text-grey-brand">{c.commercial}</div> : null}{c.stage === "KO" && c.ko_reason ? <div className="mt-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{c.ko_reason}</div> : null}</Link>)}
              </div>
            </section>;
          })}
        </div></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-navy-100 bg-white">
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <thead className="bg-navy-800 text-left text-[11px] uppercase tracking-wide text-navy-200"><tr><th className="px-3 py-2">Société</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Étape</th><th className="px-3 py-2">Prochaine action</th>{estAdmin ? <th className="px-3 py-2">Commercial</th> : null}<th className="px-3 py-2">Motif KO</th></tr></thead>
            <tbody>{clients.length === 0 ? <tr><td colSpan={estAdmin ? 6 : 5} className="px-3 py-10 text-center text-grey-brand">Aucun client.</td></tr> : clients.map((c) => <tr key={c.id} className="border-b border-navy-100 hover:bg-navy-50"><td className="px-3 py-2"><Link href={`/prospection/${c.id}`} className="font-semibold text-navy-800 hover:text-star-600">{nomClient(c)}</Link><div className="text-[11px] text-grey-brand">{c.ref}{c.siren ? ` · ${c.siren}` : ""}</div></td><td className="px-3 py-2 text-navy-700">{[c.prenom, c.nom].filter(Boolean).join(" ") || "—"}<div className="text-[11px] text-grey-brand">{c.mail || c.tel_mobile || c.tel_fixe || ""}</div></td><td className="px-3 py-2"><span className="rounded-full px-2.5 py-1 text-xs font-semibold text-navy-800" style={{ backgroundColor: stageColor(c.stage, "prospect") }}>{c.stage}</span></td><td className="px-3 py-2 text-navy-700">{c.next_action || "—"}{c.next_action_date ? <div className="text-[11px] text-grey-brand">{fmtDate(c.next_action_date)}</div> : null}</td>{estAdmin ? <td className="px-3 py-2 text-navy-700">{c.commercial}</td> : null}<td className="px-3 py-2 text-xs text-red-700">{c.stage === "KO" ? c.ko_reason || "—" : "—"}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </main>
  );
}
