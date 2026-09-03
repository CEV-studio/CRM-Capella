"use client";

import { useState } from "react";
import { BriefcaseBusiness, Building2, Pencil, UserRound, Zap } from "lucide-react";
import type { CalendarEvent, Prospect } from "@/lib/domain/database.types";

function valeur(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Non renseigné";
  return String(value);
}

function fmtRdv(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value)).replace(",", " à");
  } catch { return value; }
}

type EditableFieldProps = {
  prospectId: string;
  field: string;
  value: string | number | null | undefined;
  type?: "text" | "email" | "tel" | "date" | "number";
  suffix?: string;
};

function EditableField({ prospectId, field, value, type = "text", suffix }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value == null ? "" : String(value));
  const [draft, setDraft] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    if (draft === current) { setEditing(false); return; }
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/prospects/${prospectId}/inline`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ field, value: draft }) });
      const data = await response.json() as { value?: string | number | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      const next = data.value == null ? "" : String(data.value);
      setCurrent(next); setDraft(next); setEditing(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }

  if (editing) return <div className="min-w-0"><input autoFocus type={type} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => void save()} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } if (e.key === "Escape") { setDraft(current); setEditing(false); setError(null); } }} className="h-8 w-full rounded-lg border border-sky-capella-300 bg-white px-2 text-right text-xs font-semibold text-navy-900 outline-none ring-sky-capella-500/10 focus:ring-2"/>{error ? <div className="mt-1 text-[10px] text-red-700">{error}</div> : null}</div>;

  return <button type="button" onClick={() => { setDraft(current); setEditing(true); }} className="group inline-flex max-w-full items-center justify-end gap-1.5 rounded-lg px-1.5 py-1 text-right text-xs font-semibold text-navy-900 transition hover:bg-sky-capella-50 hover:text-sky-capella-700" title="Cliquer pour modifier"><span className={`min-w-0 break-words ${current ? "" : "font-medium text-navy-300"}`}>{current ? `${current}${suffix ?? ""}` : "Non renseigné"}</span><Pencil size={11} className="shrink-0 opacity-0 transition group-hover:opacity-100"/>{saving ? <span className="text-[10px] text-grey-brand">…</span> : null}</button>;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] items-center gap-3 py-2.5"><dt className="text-xs font-medium leading-5 text-navy-400">{label}</dt><dd className="min-w-0 text-right">{children}</dd></div>;
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Building2; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-[var(--crm-shadow-sm)]"><div className="flex items-center gap-2 border-b border-navy-100 px-4 py-3.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-capella-50 text-sky-capella-700"><Icon size={16}/></span><h3 className="font-display text-sm font-bold text-navy-900">{title}</h3></div><dl className="divide-y divide-navy-100/70 px-4 py-1">{children}</dl></section>;
}

export function ProspectInfoSidebar({ prospect, ownerName, sourceName, champsPerso, nextComparatif, isAdmin = false }: {
  prospect: Prospect;
  ownerName: string | null;
  sourceName: string | null;
  champsPerso: Array<{ cle: string; libelle: string }>;
  nextComparatif: CalendarEvent | null;
  isAdmin?: boolean;
}) {
  const p = prospect;
  const champs = champsPerso.map((c) => ({ ...c, value: p.champs_perso?.[c.cle] })).filter((c) => c.value);

  return (
    <div className="space-y-3">
      <Section title="Contact" icon={UserRound}>
        <InfoRow label="Prénom"><EditableField prospectId={p.id} field="prenom" value={p.prenom}/></InfoRow>
        <InfoRow label="Nom"><EditableField prospectId={p.id} field="nom" value={p.nom}/></InfoRow>
        <InfoRow label="E-mail"><EditableField prospectId={p.id} field="mail" value={p.mail} type="email"/></InfoRow>
        <InfoRow label="Mobile"><EditableField prospectId={p.id} field="tel_mobile" value={p.tel_mobile} type="tel"/></InfoRow>
        <InfoRow label="Fixe"><EditableField prospectId={p.id} field="tel_fixe" value={p.tel_fixe} type="tel"/></InfoRow>
      </Section>

      <Section title="Informations énergie" icon={Zap}>
        <InfoRow label="Segment"><EditableField prospectId={p.id} field="segment" value={p.segment}/></InfoRow>
        <InfoRow label="Fournisseur élec"><EditableField prospectId={p.id} field="fournisseur_electricite" value={p.fournisseur_electricite}/></InfoRow>
        <InfoRow label="Fournisseur gaz"><EditableField prospectId={p.id} field="fournisseur_gaz" value={p.fournisseur_gaz}/></InfoRow>
        <InfoRow label="Fin de contrat"><EditableField prospectId={p.id} field="date_fin_contrat" value={p.date_fin_contrat} type="date"/></InfoRow>
        <InfoRow label="PDL"><EditableField prospectId={p.id} field="pdl" value={p.pdl}/></InfoRow>
        <InfoRow label="PCE"><EditableField prospectId={p.id} field="pce" value={p.pce}/></InfoRow>
        <InfoRow label="Puissance compteur"><EditableField prospectId={p.id} field="puissance" value={p.puissance}/></InfoRow>
        <InfoRow label="CAR élec"><EditableField prospectId={p.id} field="car_electricite" value={p.car_electricite} type="number" suffix=" MWh"/></InfoRow>
        <InfoRow label="CAR gaz"><EditableField prospectId={p.id} field="car_gaz" value={p.car_gaz} type="number" suffix=" MWh"/></InfoRow>
        <InfoRow label="Option tarifaire"><EditableField prospectId={p.id} field="option_tarifaire" value={p.option_tarifaire}/></InfoRow>
      </Section>

      <Section title="Gestion du dossier" icon={BriefcaseBusiness}>
        <InfoRow label="Prochaine action"><EditableField prospectId={p.id} field="next_action" value={p.next_action}/></InfoRow>
        <InfoRow label="RDV comparatif">{nextComparatif ? <a href="/agenda" className="text-xs font-bold text-star-600 hover:text-star-700">{fmtRdv(nextComparatif.start_at)}</a> : <a href="/agenda" className="text-xs font-medium text-navy-300 hover:text-sky-capella-700">Non programmé</a>}</InfoRow>
        <InfoRow label="Score"><EditableField prospectId={p.id} field="score" value={p.score} type="number" suffix="/5"/></InfoRow>\n        <InfoRow label="Score Ellipro"><EditableField prospectId={p.id} field="score_ellipro" value={p.score_ellipro} type="number" suffix="/10"/></InfoRow>
        <InfoRow label="Score Ellipro"><EditableField prospectId={p.id} field="score_ellipro" value={p.score_ellipro} type="number" suffix="/10"/></InfoRow>
        {isAdmin ? <InfoRow label="Commercial"><span className="text-xs font-semibold text-navy-900">{valeur(ownerName)}</span></InfoRow> : null}
        <InfoRow label="Source"><span className="text-xs font-semibold text-navy-900">{valeur(sourceName)}</span></InfoRow>
        {champs.map((c) => <InfoRow key={c.cle} label={c.libelle}><span className="text-xs font-semibold text-navy-900">{valeur(c.value)}</span></InfoRow>)}
      </Section>

      <Section title="Informations entreprise" icon={Building2}>
        <InfoRow label="Raison sociale"><EditableField prospectId={p.id} field="raison_sociale" value={p.raison_sociale}/></InfoRow>
        <InfoRow label="SIREN"><EditableField prospectId={p.id} field="siren" value={p.siren}/></InfoRow>
        <InfoRow label="NAF"><EditableField prospectId={p.id} field="naf" value={p.naf}/></InfoRow>
        <InfoRow label="Code postal"><EditableField prospectId={p.id} field="code_postal" value={p.code_postal}/></InfoRow>
        <InfoRow label="Nombre de sites"><EditableField prospectId={p.id} field="nb_sites" value={p.nb_sites} type="number"/></InfoRow>
      </Section>
    </div>
  );
}
