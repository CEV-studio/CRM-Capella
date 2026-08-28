import Link from "next/link";
import { peutSupprimer, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { PROSPECT_STAGES } from "@/lib/domain/stages";
import { normalizeDigits } from "@/lib/format";
import { type LigneProspect } from "../prospection/ligne";
import { ListeProspects } from "../prospection/liste-prospects";
import { chargerSources } from "@/lib/referentiels";
import type { Prospect, Profile } from "@/lib/domain/database.types";

export const metadata = { title: "Clients — Capella CRM" };
export const dynamic = "force-dynamic";

const PAR_PAGE = 50;
const TRIS = {
  societe: { colonne: "raison_sociale", croissant: true, libelle: "Société" },
  action: { colonne: "last_action_at", croissant: false, libelle: "Dernière action" },
  relance: { colonne: "next_action_date", croissant: true, libelle: "Prochaine action" },
  etape: { colonne: "stage", croissant: true, libelle: "Étape" },
} as const;
type CleTri = keyof typeof TRIS;
type Recherche = { q?: string; etape?: string; commercial?: string; source?: string; tri?: string; page?: string };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Recherche> }) {
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const filtres = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const cleTri: CleTri = (filtres.tri ?? "action") in TRIS ? (filtres.tri as CleTri) ?? "action" : "action";
  const tri = TRIS[cleTri];
  const page = Math.max(1, Number(filtres.page ?? 1) || 1);

  let requete = db.from("prospects")
    .select("id, ref, raison_sociale, nom, prenom, mail, tel_mobile, tel_fixe, siren, stage, next_action, next_action_date, notes, last_action_at, assigned_to, source_id, date_fin_contrat, became_client_at", { count: "exact" })
    .is("deleted_at", null)
    .not("became_client_at", "is", null);

  if (filtres.etape) requete = requete.eq("stage", filtres.etape);
  if (estAdmin && filtres.commercial) {
    if (filtres.commercial === "reservoir") requete = requete.is("assigned_to", null);
    else requete = requete.eq("assigned_to", filtres.commercial);
  }
  if (filtres.source) requete = requete.eq("source_id", filtres.source);

  const q = (filtres.q ?? "").trim();
  if (q) {
    const chiffres = normalizeDigits(q);
    const motifs = [`raison_sociale.ilike.%${q}%`, `nom.ilike.%${q}%`, `prenom.ilike.%${q}%`, `mail.ilike.%${q}%`];
    if (chiffres) motifs.push(`siren_norm.like.%${chiffres}%`, `mobile_norm.like.%${chiffres}%`, `pdl_norm.like.%${chiffres}%`, `pce_norm.like.%${chiffres}%`);
    requete = requete.or(motifs.join(","));
  }

  const debut = (page - 1) * PAR_PAGE;
  const [{ data, count, error }, { data: profils }, sources] = await Promise.all([
    requete.order(tri.colonne, { ascending: tri.croissant, nullsFirst: false }).range(debut, debut + PAR_PAGE - 1),
    estAdmin ? supabase.from("profiles").select("id, full_name").order("full_name") : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[] }),
    chargerSources(),
  ]);

  const nomParCommercial = new Map((profils ?? []).map((p) => [p.id, p.full_name]));
  const nomParSource = new Map(sources.map((s) => [s.id, s.name]));
  const lignes: LigneProspect[] = ((data ?? []) as Prospect[]).map((p) => ({ ...p, commercial: p.assigned_to ? (nomParCommercial.get(p.assigned_to) ?? "—") : null, source: p.source_id ? (nomParSource.get(p.source_id) ?? null) : null }));
  const total = count ?? 0;
  const nbPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  function paramsAvec(changes: Record<string, string | null>) {
    const p = new URLSearchParams(Object.entries(filtres).filter(([, v]) => v) as [string, string][]);
    for (const [k, v] of Object.entries(changes)) v ? p.set(k, v) : p.delete(k);
    return `/clients?${p.toString()}`;
  }
  function lienTri(cle: CleTri) { return paramsAvec({ tri: cle, page: null }); }
  function lienPage(n: number) { return paramsAvec({ page: String(n) }); }

  return (
    <main className="w-full px-6 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800">Clients</h1>
          <p className="mt-1 text-sm text-grey-brand">Une fiche devient client dès son premier passage en « Demande ACD » et reste ici ensuite.</p>
        </div>
        <Link href="/prospection" className="inline-flex h-10 items-center rounded-lg border border-navy-200 bg-white px-4 text-sm font-semibold text-navy-700 hover:bg-navy-50">Voir la prospection</Link>
      </header>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-navy-100 bg-white p-3">
        <input type="search" name="q" defaultValue={filtres.q ?? ""} placeholder="Rechercher : société, nom, SIREN, téléphone…" className="h-9 min-w-64 flex-1 rounded-lg border border-navy-200 bg-white px-3 text-sm focus:border-star-500 focus:outline-none" />
        <select name="etape" defaultValue={filtres.etape ?? ""} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm"><option value="">Toutes les étapes</option>{PROSPECT_STAGES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}</select>
        {estAdmin ? <select name="commercial" defaultValue={filtres.commercial ?? ""} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm"><option value="">Tous les commerciaux</option><option value="reservoir">— Réservoir —</option>{(profils ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select> : null}
        <select name="source" defaultValue={filtres.source ?? ""} className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm"><option value="">Toutes les sources</option>{sources.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        {filtres.tri ? <input type="hidden" name="tri" value={filtres.tri} /> : null}
        <button type="submit" className="h-9 rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white hover:bg-navy-700">Filtrer</button>
        <Link href="/clients" className="h-9 rounded-lg border border-navy-200 px-3 py-2 text-xs font-semibold text-navy-700 hover:bg-navy-50">Réinitialiser</Link>
        <span className="ml-auto text-xs tabular text-grey-brand">{total} client{total > 1 ? "s" : ""}</span>
      </form>

      <Card className="overflow-hidden">
        <ListeProspects lignes={lignes} afficherCommercial={estAdmin} peutSupprimer={peutSupprimer(profil)} triLiens={{ societe: lienTri("societe"), etape: lienTri("etape"), relance: lienTri("relance"), action: lienTri("action") }} messageErreur={error?.message} />
        {nbPages > 1 ? <div className="flex items-center justify-between border-t border-navy-100 px-4 py-3 text-sm"><span className="tabular text-grey-brand">Page {page} sur {nbPages}</span><div className="flex gap-2">{page > 1 ? <Link href={lienPage(page - 1)} className="rounded-lg border border-navy-200 px-3 py-1.5 hover:bg-navy-50">Précédent</Link> : null}{page < nbPages ? <Link href={lienPage(page + 1)} className="rounded-lg border border-navy-200 px-3 py-1.5 hover:bg-navy-50">Suivant</Link> : null}</div></div> : null}
      </Card>
    </main>
  );
}
