import Link from "next/link";
import { peutSupprimer, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { CLIENT_STAGES } from "@/lib/domain/stages";
import { normalizeDigits } from "@/lib/format";
import { type LigneProspect } from "../prospection/ligne";
import { ListeProspects } from "../prospection/liste-prospects";
import { KanbanProspection } from "../prospection/kanban";
import { chargerSources } from "@/lib/referentiels";
import type { Prospect, Profile } from "@/lib/domain/database.types";

export const metadata = { title: "Clients — Capella CRM" };
export const dynamic = "force-dynamic";

const PAR_PAGE = 50;
const TRIS = {
  societe: { colonne: "raison_sociale", croissant: true },
  action: { colonne: "last_action_at", croissant: false },
  relance: { colonne: "next_action_date", croissant: true },
  etape: { colonne: "stage", croissant: true },
} as const;
type CleTri = keyof typeof TRIS;
type Recherche = { q?: string; etape?: string; commercial?: string; source?: string; tri?: string; page?: string; vue?: string };

const ETAPES_CLIENT = CLIENT_STAGES.map((s) => s.label);

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Recherche> }) {
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const filtres = await searchParams;
  const supabase = await createClient();

  const cleTri: CleTri = (filtres.tri ?? "action") in TRIS ? (filtres.tri as CleTri) : "action";
  const tri = TRIS[cleTri];
  const page = Math.max(1, Number(filtres.page ?? 1) || 1);
  const kanban = filtres.vue === "kanban";

  let requete = supabase
    .from("prospects")
    .select(
      "id, ref, raison_sociale, nom, prenom, mail, tel_mobile, tel_fixe, siren, stage, next_action, next_action_date, notes, last_action_at, assigned_to, source_id, date_fin_contrat, became_client_at, entered_conversion_at, motif_ko",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .not("became_client_at", "is", null)
    .is("entered_conversion_at", null)
    .in("stage", ETAPES_CLIENT);

  if (filtres.etape && ETAPES_CLIENT.includes(filtres.etape as never)) requete = requete.eq("stage", filtres.etape);
  if (estAdmin && filtres.commercial) {
    requete = filtres.commercial === "reservoir"
      ? requete.is("assigned_to", null)
      : requete.eq("assigned_to", filtres.commercial);
  }
  if (filtres.source) requete = requete.eq("source_id", filtres.source);

  const q = (filtres.q ?? "").trim();
  if (q) {
    const chiffres = normalizeDigits(q);
    const motifs = [
      `raison_sociale.ilike.%${q}%`,
      `nom.ilike.%${q}%`,
      `prenom.ilike.%${q}%`,
      `mail.ilike.%${q}%`,
    ];
    if (chiffres) motifs.push(
      `siren_norm.like.%${chiffres}%`,
      `mobile_norm.like.%${chiffres}%`,
      `pdl_norm.like.%${chiffres}%`,
      `pce_norm.like.%${chiffres}%`,
    );
    requete = requete.or(motifs.join(","));
  }

  const debut = (page - 1) * PAR_PAGE;
  const resultat = await requete
    .order(tri.colonne, { ascending: tri.croissant })
    .range(debut, debut + PAR_PAGE - 1);

  const [sources, profilsResult] = await Promise.all([
    chargerSources(),
    estAdmin
      ? supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[], error: null }),
  ]);

  const profils = profilsResult.data ?? [];
  const noms = new Map<string, string>(profils.map((p) => [p.id, p.full_name]));
  const src = new Map<string, string>(sources.map((s) => [s.id, s.name]));
  const lignes: LigneProspect[] = ((resultat.data ?? []) as unknown as Prospect[]).map((p) => ({
    ...p,
    commercial: p.assigned_to ? (noms.get(p.assigned_to) ?? "—") : null,
    source: p.source_id ? (src.get(p.source_id) ?? null) : null,
  }));

  const total = resultat.count ?? 0;
  const nbPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  function url(changes: Record<string, string | null>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtres)) if (v) params.set(k, v);
    for (const [k, v] of Object.entries(changes)) v ? params.set(k, v) : params.delete(k);
    return `/clients?${params.toString()}`;
  }
  const lienTri = (c: CleTri) => url({ tri: c, page: null });
  const lienPage = (n: number) => url({ page: String(n) });

  return (
    <main className="w-full px-6 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800">Clients</h1>
          <p className="mt-1 text-sm text-grey-brand">À partir de Demande ACD. « Demande de cotation » bascule automatiquement le dossier dans Cotations.</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-navy-200 p-0.5">
            <Link href={url({ vue: "liste", page: null })} className={!kanban ? "rounded-md bg-navy-800 px-3 py-1.5 text-sm font-semibold text-white" : "rounded-md px-3 py-1.5 text-sm font-semibold text-navy-700"}>Liste</Link>
            <Link href={url({ vue: "kanban", page: null })} className={kanban ? "rounded-md bg-navy-800 px-3 py-1.5 text-sm font-semibold text-white" : "rounded-md px-3 py-1.5 text-sm font-semibold text-navy-700"}>Kanban</Link>
          </div>
          <Link href="/conversion" className="inline-flex h-10 items-center rounded-lg border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-700">Voir les cotations</Link>
        </div>
      </header>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-navy-100 bg-white p-3">
        <input type="search" name="q" defaultValue={filtres.q ?? ""} placeholder="Rechercher…" className="h-9 min-w-64 flex-1 rounded-lg border border-navy-200 px-3 text-sm" />
        <select name="etape" defaultValue={filtres.etape ?? ""} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm">
          <option value="">Toutes les étapes</option>
          {CLIENT_STAGES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
        </select>
        {estAdmin ? (
          <select name="commercial" defaultValue={filtres.commercial ?? ""} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm">
            <option value="">Tous les commerciaux</option>
            <option value="reservoir">Réservoir</option>
            {profils.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        ) : null}
        <select name="source" defaultValue={filtres.source ?? ""} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm">
          <option value="">Toutes les sources</option>
          {sources.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {filtres.vue ? <input type="hidden" name="vue" value={filtres.vue} /> : null}
        <button className="h-9 rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white">Filtrer</button>
        <span className="ml-auto text-xs text-grey-brand">{total} client{total > 1 ? "s" : ""}</span>
      </form>

      {kanban ? (
        <KanbanProspection lignes={lignes} afficherCommercial={estAdmin} etapes={CLIENT_STAGES} libelleVide="Aucun client" />
      ) : (
        <Card className="overflow-hidden">
          <ListeProspects
            lignes={lignes}
            afficherCommercial={estAdmin}
            peutSupprimer={peutSupprimer(profil)}
            etapes={CLIENT_STAGES}
            libelleVide="Aucun client ne correspond."
            triLiens={{ societe: lienTri("societe"), etape: lienTri("etape"), relance: lienTri("relance"), action: lienTri("action") }}
            messageErreur={resultat.error?.message}
          />
          {nbPages > 1 ? (
            <div className="flex justify-between border-t border-navy-100 px-4 py-3 text-sm">
              <span>Page {page} sur {nbPages}</span>
              <div className="flex gap-2">
                {page > 1 ? <Link href={lienPage(page - 1)} className="rounded-lg border px-3 py-1.5">Précédent</Link> : null}
                {page < nbPages ? <Link href={lienPage(page + 1)} className="rounded-lg border px-3 py-1.5">Suivant</Link> : null}
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </main>
  );
}
