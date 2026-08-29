import { Building2, CalendarRange, Link2, Plus, UserRound, Zap } from "lucide-react";
import { ajouterCompteurRelationnel, ajouterContratHistorique, lierContact } from "@/app/(app)/prospection/[id]/relation-actions";
import type { ContactEntreprise, ContratEnergie, CrmContact, Entreprise, ProspectCompteur } from "@/lib/domain/database.types";

type ContactLie = ContactEntreprise & { contact:CrmContact; entreprises_count:number };

const INPUT = "h-9 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none focus:border-star-500";
const LABEL = "grid gap-1 text-xs font-semibold text-navy-700";

function Field({ name, label, type="text", required=false, placeholder, step }: { name:string; label:string; type?:string; required?:boolean; placeholder?:string; step?:string }) {
  return <label className={LABEL}><span>{label}{required ? " *" : ""}</span><input className={INPUT} name={name} type={type} step={step} required={required} placeholder={placeholder}/></label>;
}

function formatDate(value:string) {
  return new Intl.DateTimeFormat("fr-FR", { day:"2-digit", month:"short", year:"numeric", timeZone:"Europe/Paris" }).format(new Date(`${value}T12:00:00Z`));
}

function temporalStatus(contrat:ContratEnergie) {
  if (contrat.statut === "annule") return { label:"Annulé", cls:"bg-red-50 text-red-700" };
  if (contrat.statut === "brouillon") return { label:"Brouillon", cls:"bg-navy-50 text-navy-600" };
  const today = new Date().toISOString().slice(0, 10);
  if (contrat.date_debut > today) return { label:"À venir", cls:"bg-sky-capella-50 text-sky-capella-700" };
  if (contrat.date_fin < today) return { label:"Terminé", cls:"bg-navy-50 text-navy-500" };
  return { label:"Actif", cls:"bg-green-100 text-green-800" };
}

export function RelationContractHistory({ prospectId, entreprise, contacts, compteurs, contrats }: {
  prospectId:string;
  entreprise:Entreprise|null;
  contacts:ContactLie[];
  compteurs:ProspectCompteur[];
  contrats:ContratEnergie[];
}) {
  if (!entreprise) return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">La structure relationnelle de cette fiche sera disponible après la migration de la base.</section>;
  const actifs = contrats.filter((c) => temporalStatus(c).label === "Actif").length;
  const futurs = contrats.filter((c) => temporalStatus(c).label === "À venir").length;

  return <section className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-[var(--crm-shadow-sm)]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
      <div><div className="flex items-center gap-2"><Building2 size={18} className="text-star-500"/><h2 className="font-display text-lg font-bold text-navy-900">Relations et contrats</h2></div><p className="mt-1 text-xs text-grey-brand">Historique permanent de {entreprise.raison_sociale}.</p></div>
      <div className="flex gap-2 text-[11px] font-bold"><span className="rounded-full bg-green-100 px-2.5 py-1 text-green-800">{actifs} actif{actifs>1?"s":""}</span><span className="rounded-full bg-sky-capella-50 px-2.5 py-1 text-sky-capella-700">{futurs} à venir</span></div>
    </header>

    <div className="grid gap-5 p-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside>
        <div className="mb-3 flex items-center gap-2"><UserRound size={16} className="text-sky-capella-600"/><h3 className="text-sm font-bold text-navy-900">Contacts liés</h3><span className="text-xs text-grey-brand">({contacts.length})</span></div>
        <div className="space-y-2">{contacts.map((relation) => <div key={relation.id} className="rounded-xl border border-navy-100 bg-navy-50/40 p-3"><div className="text-sm font-bold text-navy-900">{[relation.contact.prenom,relation.contact.nom].filter(Boolean).join(" ")||relation.contact.email||relation.contact.telephone}</div><div className="mt-1 text-[11px] text-grey-brand">{relation.fonction||"Fonction non renseignée"}{relation.is_primary?" · Contact principal":""}</div><div className="mt-2 space-y-0.5 text-[11px] text-navy-600">{relation.contact.telephone?<div>{relation.contact.telephone}</div>:null}{relation.contact.email?<div className="truncate">{relation.contact.email}</div>:null}</div>{relation.entreprises_count>1?<div className="mt-2 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-star-700"><Link2 size={10}/>Lié à {relation.entreprises_count} entreprises</div>:null}</div>)}{!contacts.length?<div className="rounded-xl border border-dashed border-navy-200 p-4 text-center text-xs text-grey-brand">Aucun contact lié.</div>:null}</div>
        <details className="mt-3 rounded-xl border border-dashed border-navy-200"><summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-navy-700"><Plus size={13}/>Lier un contact</summary><form action={lierContact} className="grid gap-2 border-t border-navy-100 p-3"><input type="hidden" name="prospect_id" value={prospectId}/><div className="grid grid-cols-2 gap-2"><Field name="prenom" label="Prénom"/><Field name="nom" label="Nom"/></div><Field name="email" label="Email" type="email"/><Field name="telephone" label="Téléphone"/><Field name="fonction" label="Fonction"/><label className="flex items-center gap-2 text-xs text-navy-700"><input type="checkbox" name="is_primary"/>Contact principal</label><p className="text-[10px] leading-4 text-grey-brand">Un contact existant avec le même email ou téléphone sera automatiquement relié, sans être dupliqué.</p><button className="h-9 rounded-lg bg-navy-900 text-xs font-bold text-white hover:bg-navy-700">Enregistrer le lien</button></form></details>
      </aside>

      <div>
        <div className="mb-3 flex items-center gap-2"><CalendarRange size={16} className="text-star-500"/><h3 className="text-sm font-bold text-navy-900">Succession des contrats</h3></div>
        <div className="space-y-4">{compteurs.map((compteur) => {
          const compteurContrats = contrats.filter((c) => c.compteur_id === compteur.id).sort((a,b)=>a.date_debut.localeCompare(b.date_debut));
          return <article key={compteur.id} className="rounded-xl border border-navy-100">
            <header className="flex flex-wrap items-center justify-between gap-2 bg-navy-50/50 px-4 py-3"><div><div className="flex items-center gap-2 text-sm font-bold text-navy-900"><Zap size={14} className="text-star-500"/>{compteur.type_energie === "electricite" ? "PDL" : "PCE"} {compteur.numero}</div><div className="mt-0.5 text-[11px] text-grey-brand">{[compteur.adresse,compteur.code_postal,compteur.ville].filter(Boolean).join(" · ")||"Adresse à compléter"}</div></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-navy-600">{compteurContrats.length} contrat{compteurContrats.length>1?"s":""}</span></header>
            <div className="p-4">{compteurContrats.length?<ol className="relative ml-2 border-l-2 border-navy-100 pl-5">{compteurContrats.map((contrat) => {const status=temporalStatus(contrat);return <li key={contrat.id} className="relative pb-5 last:pb-0"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-star-500 ring-1 ring-star-200"/><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-navy-900">{contrat.fournisseur}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>{status.label}</span></div><div className="mt-1 text-xs font-semibold text-navy-600">{formatDate(contrat.date_debut)} → {formatDate(contrat.date_fin)}</div></div>{contrat.prix!=null?<div className="rounded-lg bg-star-50 px-2.5 py-1.5 text-sm font-black text-star-700">{contrat.prix.toLocaleString("fr-FR",{maximumFractionDigits:5})} {contrat.unite_prix}</div>:null}</div><div className="mt-2 flex flex-wrap gap-2 text-[10px] text-grey-brand">{contrat.reference_contrat?<span>Réf. {contrat.reference_contrat}</span>:null}{contrat.date_signature?<span>Signé le {formatDate(contrat.date_signature)}</span>:null}{contrat.consommation_mwh!=null?<span>{contrat.consommation_mwh} MWh</span>:null}</div>{contrat.details_prix?<div className="mt-2 text-xs text-navy-600">{contrat.details_prix}</div>:null}{contrat.notes?<div className="mt-1 text-xs text-grey-brand">{contrat.notes}</div>:null}</li>})}</ol>:<div className="rounded-lg border border-dashed border-navy-200 p-4 text-center text-xs text-grey-brand">Aucun contrat enregistré sur ce compteur.</div>}
              <details className="mt-4 rounded-lg border border-dashed border-star-200 bg-star-50/30"><summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-star-700"><Plus size={13}/>Ajouter le contrat suivant</summary><form action={ajouterContratHistorique} className="grid gap-3 border-t border-star-100 p-3 sm:grid-cols-2"><input type="hidden" name="prospect_id" value={prospectId}/><input type="hidden" name="compteur_id" value={compteur.id}/><input type="hidden" name="type_energie" value={compteur.type_energie}/><Field name="fournisseur" label="Nouveau fournisseur" required/><Field name="reference_contrat" label="Référence contrat"/><Field name="date_signature" label="Date de signature" type="date"/><div/><Field name="date_debut" label="Date de début" type="date" required/><Field name="date_fin" label="Nouvelle date de fin" type="date" required/><Field name="prix" label="Prix" type="number" step="any"/><label className={LABEL}><span>Unité du prix</span><select name="unite_prix" className={INPUT}><option value="">—</option>{["EUR/MWh","EUR/kWh","EUR/mois","Autre"].map((x)=><option key={x}>{x}</option>)}</select></label><Field name="consommation_mwh" label="Consommation contractuelle (MWh)" type="number" step="any"/><label className={LABEL}><span>État d’enregistrement</span><select name="statut" defaultValue="signe" className={INPUT}><option value="signe">Signé</option><option value="brouillon">Brouillon</option><option value="annule">Annulé — conservé dans l’historique</option></select></label><label className={`${LABEL} sm:col-span-2`}><span>Détail du prix</span><input name="details_prix" className={INPUT} placeholder="Ex. fixe 3 ans, abonnement, formule d’indexation…"/></label><label className={`${LABEL} sm:col-span-2`}><span>Notes</span><textarea name="notes" rows={2} className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm outline-none focus:border-star-500"/></label><button className="h-9 rounded-lg bg-star-500 text-xs font-bold text-white hover:bg-star-600 sm:col-span-2">Ajouter sans modifier les contrats précédents</button></form></details>
            </div>
          </article>;
        })}{!compteurs.length?<div className="rounded-xl border border-dashed border-navy-200 p-8 text-center text-sm text-grey-brand">Ajoute d’abord un compteur pour commencer son historique contractuel.</div>:null}</div>
        <details className="mt-4 rounded-xl border border-dashed border-navy-200"><summary className="flex cursor-pointer items-center gap-1.5 px-4 py-3 text-xs font-bold text-navy-700"><Plus size={14}/>Ajouter un compteur ou un site</summary><form action={ajouterCompteurRelationnel} className="grid gap-3 border-t border-navy-100 p-4 sm:grid-cols-2"><input type="hidden" name="prospect_id" value={prospectId}/><label className={LABEL}><span>Énergie *</span><select required name="type_energie" className={INPUT}><option value="electricite">Électricité — PDL</option><option value="gaz">Gaz — PCE</option></select></label><Field name="numero" label="Numéro PDL/PCE" required/><Field name="siret" label="SIRET du site"/><Field name="segment" label="Segment électrique"/><label className={`${LABEL} sm:col-span-2`}><span>Adresse</span><input name="adresse" className={INPUT}/></label><Field name="code_postal" label="Code postal"/><Field name="ville" label="Ville"/><button className="h-9 rounded-lg bg-navy-900 text-xs font-bold text-white hover:bg-navy-700 sm:col-span-2">Ajouter le compteur</button></form></details>
      </div>
    </div>
  </section>;
}
