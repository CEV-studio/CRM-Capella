import type { Prospect } from "@/lib/domain/database.types";
import {
  enregistrerEntreprise, ajouterContact, supprimerContact,
  ajouterCompteur, supprimerCompteur, ajouterFactureCompteur,
} from "@/app/(app)/prospection/[id]/dossier-actions";

type Contact = { id:string; nom:string; prenom:string; telephone:string|null; email:string|null; fonction:string|null; is_primary:boolean };
type Compteur = { id:string; type_energie:"electricite"|"gaz"; numero:string; siret:string|null; adresse:string|null; code_postal:string|null; ville:string|null; segment:string|null; date_echeance:string|null };
type Facture = { id:string; compteur_id:string|null; file_name:string; created_at:string };
type ProspectDossier = Prospect & { adresse_entreprise?:string|null; ville?:string|null };

const FONCTIONS = ["Gérant", "Président", "Comptable", "Directeur", "Directeur administratif et financier"];

function Input({ name, label, value, required=false, type="text" }: { name:string; label:string; value?:string|null; required?:boolean; type?:string }) {
  return <label className="grid gap-1 text-xs font-medium text-navy-700"><span>{label}{required ? " *" : ""}</span><input name={name} type={type} required={required} defaultValue={value || ""} className="h-9 rounded-lg border border-navy-200 bg-white px-3 text-sm font-normal text-navy-800" /></label>;
}

function completeness(p: ProspectDossier, contacts: Contact[], compteurs: Compteur[], factures: Facture[]) {
  const checks = [
    Boolean(p.raison_sociale), Boolean(p.siren?.replace(/\D/g, "").length === 9), Boolean(p.adresse_entreprise), Boolean(p.code_postal), Boolean(p.ville),
    contacts.length > 0,
    compteurs.length > 0,
    compteurs.every(c => Boolean(c.numero && c.siret && c.adresse && c.code_postal && c.ville && c.date_echeance && (c.type_energie === "gaz" || c.segment))),
    compteurs.length > 0 && compteurs.every(c => factures.some(f => f.compteur_id === c.id)),
  ];
  return { done: checks.filter(Boolean).length, total: checks.length, ready: checks.every(Boolean) };
}

export function DossierTransfert({ prospect, contacts, compteurs, factures }: { prospect:ProspectDossier; contacts:Contact[]; compteurs:Compteur[]; factures:Facture[] }) {
  const state = completeness(prospect, contacts, compteurs, factures);
  const pct = Math.round((state.done / state.total) * 100);
  const pdl = compteurs.filter(c => c.type_energie === "electricite");
  const pce = compteurs.filter(c => c.type_energie === "gaz");

  const renderCompteur = (c: Compteur) => {
    const docs = factures.filter(f => f.compteur_id === c.id);
    return <div key={c.id} className="rounded-lg border border-navy-100 bg-navy-50/30 p-3">
      <div className="flex items-start justify-between gap-2"><div><div className="text-xs font-semibold text-navy-800">{c.numero}</div><div className="mt-0.5 text-[11px] text-grey-brand">{c.adresse || "Adresse à compléter"}{c.ville ? ` · ${c.ville}` : ""}</div></div><form action={supprimerCompteur}><input type="hidden" name="prospect_id" value={prospect.id}/><input type="hidden" name="id" value={c.id}/><button className="text-[11px] text-red-700">Supprimer</button></form></div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-navy-700">{c.segment ? <span className="rounded bg-white px-2 py-1">{c.segment}</span> : null}{c.date_echeance ? <span className="rounded bg-white px-2 py-1">Échéance {c.date_echeance}</span> : null}<span className="rounded bg-white px-2 py-1">{docs.length} facture{docs.length>1?"s":""}</span></div>
      {docs.length ? <div className="mt-2 space-y-1">{docs.map(d => <div key={d.id} className="truncate text-[11px] text-grey-brand">PDF · {d.file_name}</div>)}</div> : null}
      <form action={ajouterFactureCompteur} className="mt-2 flex items-center gap-2"><input type="hidden" name="prospect_id" value={prospect.id}/><input type="hidden" name="compteur_id" value={c.id}/><input name="file" type="file" accept="application/pdf" required className="min-w-0 flex-1 text-[10px]"/><button className="rounded-md bg-navy-800 px-2 py-1.5 text-[10px] font-semibold text-white">Ajouter PDF</button></form>
    </div>;
  };

  return <div className="space-y-4">
    <section className="rounded-xl border border-navy-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-navy-800">Dossier à transmettre</h2><p className="text-[11px] text-grey-brand">Prépare uniquement les données nécessaires au courtier.</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${state.ready ? "bg-green-100 text-green-800" : "bg-amber-50 text-amber-800"}`}>{state.ready ? "Dossier complet" : `${state.done}/${state.total}`}</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-50"><div className="h-full bg-star-500 transition-all" style={{width:`${pct}%`}}/></div>
      <p className="mt-2 text-[11px] text-grey-brand">{state.ready ? "✓ Prêt à être saisi/transmis dans le CRM du courtier." : "Complète entreprise, contact, compteur(s), échéances et facture(s)."}</p>
    </section>

    <details open className="rounded-xl border border-navy-100 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy-800">Entreprise</summary><form action={enregistrerEntreprise} className="grid gap-3 border-t border-navy-100 p-4"><input type="hidden" name="prospect_id" value={prospect.id}/><Input name="raison_sociale" label="Nom de l'entreprise" value={prospect.raison_sociale}/><Input name="siren" label="SIREN (9 chiffres)" value={prospect.siren}/><Input name="adresse_entreprise" label="Adresse" value={prospect.adresse_entreprise}/><div className="grid grid-cols-2 gap-2"><Input name="code_postal" label="Code postal" value={prospect.code_postal}/><Input name="ville" label="Ville" value={prospect.ville}/></div><button className="h-9 rounded-lg bg-navy-800 px-3 text-xs font-semibold text-white">Enregistrer</button></form></details>

    <details open className="rounded-xl border border-navy-100 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy-800">Contacts <span className="text-grey-brand">({contacts.length})</span></summary><div className="space-y-3 border-t border-navy-100 p-4">{contacts.map(c => <div key={c.id} className="rounded-lg bg-navy-50/50 p-3"><div className="flex justify-between gap-2"><div><div className="text-xs font-semibold text-navy-800">{c.prenom} {c.nom}{c.is_primary ? " · Principal" : ""}</div><div className="text-[11px] text-grey-brand">{c.fonction || "Fonction non renseignée"}</div></div><form action={supprimerContact}><input type="hidden" name="prospect_id" value={prospect.id}/><input type="hidden" name="id" value={c.id}/><button className="text-[11px] text-red-700">Supprimer</button></form></div><div className="mt-1 text-[11px] text-grey-brand">{c.telephone || "—"} · {c.email || "—"}</div></div>)}
      <details className="rounded-lg border border-dashed border-navy-200"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-navy-700">+ Ajouter un contact</summary><form action={ajouterContact} className="grid gap-2 border-t border-navy-100 p-3"><input type="hidden" name="prospect_id" value={prospect.id}/><div className="grid grid-cols-2 gap-2"><Input name="prenom" label="Prénom" required/><Input name="nom" label="Nom" required/></div><Input name="telephone" label="Téléphone"/><Input name="email" label="Mail" type="email"/><label className="grid gap-1 text-xs font-medium text-navy-700"><span>Statut / fonction</span><select name="fonction" className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm"><option value="">—</option>{FONCTIONS.map(f=><option key={f}>{f}</option>)}</select></label><label className="flex items-center gap-2 text-xs text-navy-700"><input type="checkbox" name="is_primary"/> Contact principal</label><button className="h-9 rounded-lg bg-navy-800 text-xs font-semibold text-white">Ajouter</button></form></details>
    </div></details>

    <details open className="rounded-xl border border-navy-100 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy-800">⚡ PDL <span className="text-grey-brand">({pdl.length})</span></summary><div className="space-y-3 border-t border-navy-100 p-4">{pdl.map(renderCompteur)}<CompteurForm prospectId={prospect.id} type="electricite" /></div></details>
    <details open className="rounded-xl border border-navy-100 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy-800">🔥 PCE <span className="text-grey-brand">({pce.length})</span></summary><div className="space-y-3 border-t border-navy-100 p-4">{pce.map(renderCompteur)}<CompteurForm prospectId={prospect.id} type="gaz" /></div></details>
  </div>;
}

function CompteurForm({ prospectId, type }: { prospectId:string; type:"electricite"|"gaz" }) {
  const elec = type === "electricite";
  return <details className="rounded-lg border border-dashed border-navy-200"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-navy-700">+ Ajouter un {elec ? "PDL" : "PCE"}</summary><form action={ajouterCompteur} className="grid gap-2 border-t border-navy-100 p-3"><input type="hidden" name="prospect_id" value={prospectId}/><input type="hidden" name="type_energie" value={type}/><Input name="numero" label={`Numéro ${elec ? "PDL" : "PCE"}`} required/><Input name="siret" label={`SIRET ${elec ? "PDL" : "PCE"}`}/><Input name="adresse" label="Adresse"/><div className="grid grid-cols-2 gap-2"><Input name="code_postal" label="Code postal"/><Input name="ville" label="Ville"/></div>{elec ? <label className="grid gap-1 text-xs font-medium text-navy-700"><span>Segment</span><select name="segment" className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm"><option value="">—</option>{["C5","C4","C3","C2"].map(s=><option key={s}>{s}</option>)}</select></label> : null}<Input name="date_echeance" label={`Date d'échéance ${elec ? "électricité" : "gaz"}`} type="date"/><button className="h-9 rounded-lg bg-navy-800 text-xs font-semibold text-white">Ajouter</button></form></details>;
}
