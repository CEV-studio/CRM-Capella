import Link from "next/link";
import { Building2, CalendarCheck2, Gauge, Search, WalletCards } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtEuros } from "@/lib/format";

export const metadata = { title: "Mes clients — Capella CRM" };
export const dynamic = "force-dynamic";

type Recherche = { q?: string };
type AffaireSignee = {
  id: string;
  prospect_id: string | null;
  commercial_id: string;
  type_energie: string | null;
  commission: number | null;
  date_signature: string | null;
};
type Client = {
  id: string;
  ref: string | null;
  raison_sociale: string | null;
  nom: string | null;
  prenom: string | null;
  mail: string | null;
  tel_mobile: string | null;
  tel_fixe: string | null;
};

function libelle(client: Client) {
  return client.raison_sociale || [client.prenom, client.nom].filter(Boolean).join(" ") || "Client sans nom";
}

export default async function MesClientsPage({ searchParams }: { searchParams: Promise<Recherche> }) {
  await requireProfile();
  const filtres = await searchParams;
  const supabase = await createClient();
  const db = supabase;

  const { data: affairesData, error } = await db
    .from("affaires")
    .select("id, prospect_id, commercial_id, type_energie, commission, date_signature")
    .eq("stage", "Signé")
    .is("deleted_at", null)
    .not("prospect_id", "is", null)
    .order("date_signature", { ascending: false });

  const affaires = (affairesData ?? []) as AffaireSignee[];
  const prospectIds = [...new Set(affaires.map((a) => a.prospect_id).filter((id): id is string => Boolean(id)))];

  const [{ data: clientsData }, { data: compteursData }, { data: profilsData }] = await Promise.all([
    prospectIds.length
      ? db.from("prospects").select("id, ref, raison_sociale, nom, prenom, mail, tel_mobile, tel_fixe").in("id", prospectIds).is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    prospectIds.length
      ? db.from("prospect_compteurs").select("id, prospect_id, type_energie").in("prospect_id", prospectIds).is("archived_at", null)
      : Promise.resolve({ data: [] }),
    db.from("profiles").select("id, full_name"),
  ]);

  const affairesParClient = new Map<string, AffaireSignee[]>();
  for (const affaire of affaires) {
    if (!affaire.prospect_id) continue;
    const liste = affairesParClient.get(affaire.prospect_id) ?? [];
    liste.push(affaire);
    affairesParClient.set(affaire.prospect_id, liste);
  }

  const compteursParClient = new Map<string, { id: string; type_energie: string }[]>();
  for (const compteur of compteursData ?? []) {
    const liste = compteursParClient.get(compteur.prospect_id) ?? [];
    liste.push(compteur);
    compteursParClient.set(compteur.prospect_id, liste);
  }

  const commerciaux = new Map((profilsData ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
  const q = (filtres.q ?? "").trim().toLowerCase();
  const clients = ((clientsData ?? []) as Client[])
    .filter((client) => !q || `${libelle(client)} ${client.ref ?? ""} ${client.mail ?? ""} ${client.tel_mobile ?? ""} ${client.tel_fixe ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => libelle(a).localeCompare(libelle(b), "fr"));

  return (
    <main className="w-full px-6 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800">Mes clients</h1>
          <p className="mt-1 text-sm text-grey-brand">Une fiche par entreprise, avec toutes ses affaires et tous ses compteurs regroupés.</p>
        </div>
        <div className="rounded-full bg-navy-50 px-3 py-1.5 text-xs font-bold text-navy-700">{clients.length} client{clients.length > 1 ? "s" : ""}</div>
      </header>

      <form method="get" className="mb-5 flex items-center gap-2 rounded-xl border border-navy-100 bg-white p-3 shadow-sm">
        <Search size={18} className="ml-1 shrink-0 text-navy-400" aria-hidden />
        <input name="q" type="search" defaultValue={filtres.q ?? ""} placeholder="Rechercher une entreprise, un contact…" className="h-9 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm outline-none" />
        <button className="h-9 rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white">Rechercher</button>
      </form>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Lecture impossible : {error.message}</div> : null}
      {!error && clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy-200 bg-white p-12 text-center">
          <Building2 size={30} className="mx-auto text-navy-300" />
          <p className="mt-3 text-sm font-semibold text-navy-700">Aucun client signé pour le moment.</p>
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const dossiers = affairesParClient.get(client.id) ?? [];
            const compteurs = compteursParClient.get(client.id) ?? [];
            const total = dossiers.reduce((s, a) => s + Number(a.commission ?? 0), 0);
            const derniereSignature = dossiers.map((a) => a.date_signature).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
            const energies = [...new Set(compteurs.map((c) => c.type_energie === "gaz" ? "Gaz" : "Électricité"))];
            const commercial = commerciaux.get(dossiers[0]?.commercial_id) ?? "—";
            return (
              <Link key={client.id} href={`/prospection/${client.id}`} className="group rounded-xl border border-navy-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-star-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-navy-800 group-hover:text-star-600">{libelle(client)}</h2>
                    <p className="mt-0.5 text-xs text-grey-brand">{client.ref} · {commercial}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800">Client signé</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-navy-50 p-3"><div className="flex items-center gap-1.5 text-grey-brand"><WalletCards size={13}/>Affaires</div><div className="mt-1 font-bold text-navy-800">{dossiers.length} · {fmtEuros(total)}</div></div>
                  <div className="rounded-lg bg-sky-capella-50 p-3"><div className="flex items-center gap-1.5 text-grey-brand"><Gauge size={13}/>Compteurs</div><div className="mt-1 font-bold text-navy-800">{compteurs.length} · {energies.join(" + ") || "—"}</div></div>
                </div>
                {derniereSignature ? <div className="mt-3 flex items-center gap-1.5 text-xs text-green-700"><CalendarCheck2 size={14}/>Dernière signature : {fmtDate(derniereSignature)}</div> : null}
                {client.mail ? <div className="mt-2 truncate text-xs text-grey-brand">{client.mail}</div> : null}
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
