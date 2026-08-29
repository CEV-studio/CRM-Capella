import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles, UsersRound } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, KpiTile, StageBadge } from "@/components/ui";
import { AFFAIRE_STAGES, PROSPECT_STAGES, stageColor } from "@/lib/domain/stages";
import { fmtEuros, fmtNombre, fmtPourcent, MOIS } from "@/lib/format";
import { anneesDisponibles, calculerIndicateurs, commissionsParMois, filtrerAffaires } from "@/lib/domain/commissions";
import { FiltresPeriode } from "./filtres-periode";
import { chargerApporteurs } from "@/lib/referentiels";
import type { Affaire, Profile, Prospect } from "@/lib/domain/database.types";
import { ProspectFichePopup } from "@/components/prospect-fiche-popup";

export const metadata = { title: "Tableau de bord — Capella CRM" };
export const dynamic = "force-dynamic";
type Recherche = { annee?: string; mois?: string; commercial?: string; apporteur?: string };
type EvenementSemaine = { id:string; prospect_id:string; profile_id:string; title:string; start_at:string; end_at:string };

const ETAPES_CLOTUREES = new Set(["KO", "Numéro KO", "Pas intéressé", "DDF trop éloignée"]);

function dateParis(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Paris", year:"numeric", month:"2-digit", day:"2-digit" }).format(typeof value === "string" ? new Date(value) : value);
}

function bornesSemaine() {
  const today = dateParis(new Date());
  const pivot = new Date(`${today}T12:00:00Z`);
  const lundi = new Date(pivot);
  lundi.setUTCDate(pivot.getUTCDate() - ((pivot.getUTCDay() + 6) % 7));
  const suivant = new Date(lundi);
  suivant.setUTCDate(lundi.getUTCDate() + 7);
  return { debut:dateParis(lundi), fin:dateParis(suivant) };
}

export default async function TableauDeBordPage({ searchParams }: { searchParams: Promise<Recherche> }) {
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const filtres = await searchParams;
  const supabase = await createClient();
  const semaine = bornesSemaine();

  const [{ data: affairesBrutes }, { data: prospectsBruts }, { data: profils }, { data: evenementsBruts }, apporteurs] = await Promise.all([
    supabase.from("affaires").select("commercial_id, apporteur_id, stage, date_signature, date_relance, commission, raison_sociale").is("deleted_at", null),
    supabase.from("prospects").select("id, raison_sociale, nom, prenom, stage, next_action_date, assigned_to").is("deleted_at", null),
    supabase.from("profiles").select("id, full_name, commission_rate").eq("is_active", true).order("full_name"),
    estAdmin ? supabase.from("calendar_events").select("id, prospect_id, profile_id, title, start_at, end_at").eq("kind", "rdv").eq("status", "confirmed").gte("start_at", `${semaine.debut}T00:00:00Z`).lt("start_at", `${semaine.fin}T23:59:59Z`).order("start_at") : Promise.resolve({ data: [] as EvenementSemaine[] }),
    chargerApporteurs(),
  ]);

  const toutesAffaires = (affairesBrutes ?? []) as Affaire[];
  const listeProfils = (profils ?? []) as Pick<Profile, "id" | "full_name" | "commission_rate">[];
  const listeApporteurs = apporteurs;
  const tauxCommercial = new Map(listeProfils.map((p) => [p.id, Number(p.commission_rate)]));
  const tauxApporteur = new Map(listeApporteurs.map((a) => [a.id, Number(a.commission_rate)]));
  const annees = anneesDisponibles(toutesAffaires);
  const annee = Number(filtres.annee) || annees[0];
  const mois = Number(filtres.mois) || undefined;
  const affaires = filtrerAffaires(toutesAffaires, { annee, mois, commercialId: filtres.commercial, apporteurId: filtres.apporteur });
  const kpi = calculerIndicateurs(affaires, tauxCommercial, tauxApporteur);
  const parMois = commissionsParMois(affaires, annee, tauxCommercial);
  const totalMois = parMois.reduce((t, l) => ({ nb: t.nb + l.nbSignees, ca: t.ca + l.caSigne, com: t.com + l.commissions }), { nb: 0, ca: 0, com: 0 });

  const affairesParEtape = new Map<string, number>();
  for (const a of affaires) affairesParEtape.set(a.stage, (affairesParEtape.get(a.stage) ?? 0) + 1);
  const prospects = (prospectsBruts ?? []) as Pick<Prospect, "id" | "raison_sociale" | "nom" | "prenom" | "stage" | "next_action_date" | "assigned_to">[];
  const prospectsParEtape = new Map<string, number>();
  for (const p of prospects) prospectsParEtape.set(p.stage, (prospectsParEtape.get(p.stage) ?? 0) + 1);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const relancesProspection = prospects.filter((p) => p.next_action_date != null && p.next_action_date >= aujourdhui).length;
  const periode = mois ? `${MOIS[mois - 1]} ${annee}` : `Année ${annee}`;
  const evenementsSemaine = ((evenementsBruts ?? []) as EvenementSemaine[]).filter((e) => { const d=dateParis(e.start_at); return d>=semaine.debut&&d<semaine.fin; });
  const prospectsIndex = new Map(prospects.map((p) => [p.id, p]));
  const managerRows = listeProfils.map((commercial) => {
    const portefeuille = prospects.filter((p) => p.assigned_to === commercial.id);
    const dossiers = affaires.filter((a) => a.commercial_id === commercial.id);
    const valides = dossiers.filter((a) => a.stage === "Signé");
    return {
      id:commercial.id,
      nom:commercial.full_name,
      actifs:portefeuille.filter((p) => !ETAPES_CLOTUREES.has(p.stage)).length,
      retards:portefeuille.filter((p) => p.next_action_date && p.next_action_date < aujourdhui && !ETAPES_CLOTUREES.has(p.stage)).length,
      rdv:evenementsSemaine.filter((e) => e.profile_id === commercial.id).length,
      enCours:dossiers.filter((a) => !["Signé", "KO"].includes(a.stage)).length,
      valides:valides.length,
      montant:valides.reduce((total, a) => total + Number(a.commission || 0), 0),
    };
  });

  return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
    <header className="crm-page-header mb-5 flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-star-600"><Sparkles size={14} /> Cockpit commercial</div>
        <h1 className="font-display text-2xl font-bold text-navy-800">Bonjour {profil.full_name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-grey-brand">{estAdmin ? "Vue d'ensemble de Capella Energy." : "Ton activité. Tu ne vois que tes propres chiffres."}</p>
      </div>
      <div className="hidden h-14 w-14 items-center justify-center rounded-2xl bg-[var(--crm-gradient-navy)] shadow-[var(--crm-shadow-card)] sm:flex"><Sparkles className="text-star-400" size={24} /></div>
    </header>

    <div className="mb-5"><FiltresPeriode chemin="/" annees={annees} commerciaux={estAdmin ? listeProfils.map((p) => ({ value: p.id, label: p.full_name })) : []} apporteurs={estAdmin ? listeApporteurs.map((a) => ({ value: a.id, label: a.name })) : []}/></div>

    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiTile label="Montant validé ADV" value={fmtEuros(kpi.caSigne)} hint={periode}/>
      <KpiTile label="Dossiers validés ADV" value={fmtNombre(kpi.nbSignees)} hint={periode}/>
      <KpiTile label="Taux de validation" value={fmtPourcent(kpi.tauxConversion)} hint="Validés ADV sur affaires suivies"/>
      <KpiTile label="Affaires en cours" value={fmtNombre(kpi.nbEnCours)} hint="Hors dossiers validés et perdus"/>
      <KpiTile label={estAdmin ? "Commissions commerciaux validées" : "Ma commission validée"} value={fmtEuros(kpi.commissionsCommerciaux)} hint="Comptabilisée après validation ADV"/>
      <KpiTile label={estAdmin ? "Commission Capella en attente" : "Ma commission en attente"} value={fmtEuros(estAdmin ? kpi.caEnAttente : kpi.commissionsCommerciauxEnAttente)} hint={estAdmin ? "Commission globale renseignée, validation finale en attente" : "Déjà renseignée par l’ADV, validation finale en attente"}/>
      <KpiTile label="Relances à venir" value={fmtNombre(kpi.relancesAVenir + relancesProspection)} hint={`${kpi.relancesAVenir} en cotation · ${relancesProspection} en prospection`}/>
    </div>

    {estAdmin ? <>
      <Card className="mb-6 overflow-hidden"><CardHeader title="Pilotage de l’équipe" hint={`Comparatif par commercial · ${periode}`} action={<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-500"><UsersRound size={14}/>{managerRows.length} commerciaux</span>}/><div className="scroll-slim overflow-x-auto"><table className="w-full min-w-[62rem] border-collapse text-sm"><thead className="bg-navy-800"><tr>{["Commercial", "Prospects actifs", "Actions en retard", "Comparatifs semaine", "Affaires en cours", "Validés ADV", "Montant validé"].map((titre)=><th key={titre} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-200">{titre}</th>)}</tr></thead><tbody>{managerRows.map((row)=><tr key={row.id} className={`border-b border-navy-100 ${row.id===profil.id?"bg-star-50/60":"hover:bg-sky-capella-50/40"}`}><td className="px-4 py-3 font-semibold text-navy-900">{row.nom}{row.id===profil.id?<span className="ml-2 rounded-full bg-star-100 px-2 py-0.5 text-[10px] font-bold text-star-700">Moi</span>:null}</td><td className="tabular px-4 py-3 font-bold text-navy-800">{row.actifs}</td><td className={`tabular px-4 py-3 font-bold ${row.retards?"text-red-700":"text-green-700"}`}>{row.retards}</td><td className="tabular px-4 py-3 font-bold text-sky-capella-700">{row.rdv}</td><td className="tabular px-4 py-3">{row.enCours}</td><td className="tabular px-4 py-3 font-bold">{row.valides}</td><td className="tabular px-4 py-3 font-bold text-star-700">{fmtEuros(row.montant)}</td></tr>)}<tr className="bg-navy-800 font-bold text-white"><td className="px-4 py-3">Total équipe</td><td className="tabular px-4 py-3">{managerRows.reduce((t,r)=>t+r.actifs,0)}</td><td className="tabular px-4 py-3 text-red-200">{managerRows.reduce((t,r)=>t+r.retards,0)}</td><td className="tabular px-4 py-3 text-sky-200">{evenementsSemaine.length}</td><td className="tabular px-4 py-3">{managerRows.reduce((t,r)=>t+r.enCours,0)}</td><td className="tabular px-4 py-3">{managerRows.reduce((t,r)=>t+r.valides,0)}</td><td className="tabular px-4 py-3 text-star-300">{fmtEuros(managerRows.reduce((t,r)=>t+r.montant,0))}</td></tr></tbody></table></div></Card>

      <Card className="mb-6 overflow-hidden"><CardHeader title="Comparatifs à présenter cette semaine" hint={`${evenementsSemaine.length} rendez-vous confirmé${evenementsSemaine.length>1?"s":""}`} action={<Link href="/agenda" className="inline-flex items-center gap-1 text-sm font-semibold text-star-600 hover:text-star-700">Agenda <ArrowRight size={14}/></Link>}/>{evenementsSemaine.length?<div className="divide-y divide-navy-100">{evenementsSemaine.map((event)=>{const prospect=prospectsIndex.get(event.prospect_id);const commercial=listeProfils.find((p)=>p.id===event.profile_id);const label=prospect?.raison_sociale||[prospect?.prenom,prospect?.nom].filter(Boolean).join(" ")||"Prospect";return <div key={event.id} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-sky-capella-50/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-star-50 text-star-600"><CalendarDays size={18}/></div><div className="min-w-52 flex-1"><ProspectFichePopup prospectId={event.prospect_id} prospectLabel={label} className="font-semibold text-navy-900 hover:text-star-600">{label}</ProspectFichePopup><div className="mt-0.5 text-xs text-grey-brand">{event.title}</div></div><div className="tabular text-sm font-bold text-navy-800">{new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(event.start_at))}</div><div className="min-w-40 text-right text-xs font-semibold text-navy-600">{commercial?.full_name||"Non attribué"}</div></div>})}</div>:<div className="px-5 py-10 text-center text-sm text-grey-brand">Aucun comparatif programmé cette semaine.</div>}</Card>
    </> : null}

    <Card className="mb-6 overflow-hidden"><CardHeader title={`Commissions validées par mois — ${annee}`} hint="Un dossier est rattaché au mois de sa validation ADV." action={<Link href="/commissions" className="inline-flex items-center gap-1 text-sm font-semibold text-star-600 hover:text-star-700">Détail <ArrowRight size={14}/></Link>}/><div className="scroll-slim overflow-x-auto"><table className="w-full min-w-[36rem] border-collapse text-sm"><thead className="bg-navy-800"><tr>{["Mois", "Dossiers validés", "Montant validé", "Commissions"].map((t)=><th key={t} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-200">{t}</th>)}</tr></thead><tbody>{parMois.map((l)=><tr key={l.mois} className={l.nbSignees>0?"border-b border-navy-100":"border-b border-navy-100 text-navy-300"}><td className="px-4 py-2.5">{MOIS[l.mois-1]}</td><td className="tabular px-4 py-2.5">{l.nbSignees}</td><td className="tabular px-4 py-2.5">{fmtEuros(l.caSigne)}</td><td className="tabular px-4 py-2.5">{fmtEuros(l.commissions)}</td></tr>)}<tr className="bg-navy-800 font-bold text-white"><td className="px-4 py-3">Total</td><td className="tabular px-4 py-3">{totalMois.nb}</td><td className="tabular px-4 py-3">{fmtEuros(totalMois.ca)}</td><td className="tabular px-4 py-3 text-star-300">{fmtEuros(totalMois.com)}</td></tr></tbody></table></div></Card>

    <div className="grid gap-6 md:grid-cols-2">
      <Card><CardHeader title="Cotations par étape" hint={periode}/><ul className="divide-y divide-navy-100">{AFFAIRE_STAGES.map((s)=><li key={s.label} className="flex items-center justify-between px-5 py-2.5 hover:bg-sky-capella-50/50"><StageBadge label={s.label==="Signé"?"Validé ADV":s.label} color={stageColor(s.label,"affaire")}/><span className="tabular text-sm font-bold text-navy-800">{affairesParEtape.get(s.label)??0}</span></li>)}</ul></Card>
      <Card><CardHeader title="Prospection par étape" hint="Non filtré par période."/><ul className="divide-y divide-navy-100">{PROSPECT_STAGES.map((s)=><li key={s.label} className="flex items-center justify-between px-5 py-2.5 hover:bg-sky-capella-50/50"><StageBadge label={s.label} color={stageColor(s.label,"prospect")}/><span className="tabular text-sm font-bold text-navy-800">{prospectsParEtape.get(s.label)??0}</span></li>)}</ul></Card>
    </div>
  </main>;
}
