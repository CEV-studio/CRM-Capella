"use client";

import { useState } from "react";
import type { Prospect } from "@/lib/domain/database.types";

function valeur(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
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
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/prospects/${prospectId}/inline`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field, value: draft }),
      });
      const data = await response.json() as { value?: string | number | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      const next = data.value == null ? "" : String(data.value);
      setCurrent(next);
      setDraft(next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="min-w-0">
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void save(); }
            if (e.key === "Escape") { setDraft(current); setEditing(false); setError(null); }
          }}
          className="h-8 w-full rounded-md border border-star-300 bg-white px-2 text-right text-xs font-semibold text-navy-800 outline-none ring-star-500/20 focus:ring-2"
        />
        {error ? <div className="mt-1 text-[10px] text-red-700">{error}</div> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(current); setEditing(true); }}
      className="group inline-flex max-w-full items-center justify-end gap-1 rounded-md px-1.5 py-1 text-right text-xs font-semibold text-navy-800 transition hover:bg-star-50 hover:text-star-700"
      title="Cliquer pour modifier"
    >
      <span className="min-w-0 break-words">{current ? `${current}${suffix ?? ""}` : "—"}</span>
      <span className="shrink-0 text-[10px] text-star-500 opacity-0 transition group-hover:opacity-100">✎</span>
      {saving ? <span className="text-[10px] text-grey-brand">…</span> : null}
    </button>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-3 border-b border-navy-100/70 py-2 last:border-0">
      <dt className="text-xs font-medium leading-5 text-navy-400">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function Panel({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group overflow-hidden rounded-xl border border-navy-200 border-l-4 border-l-star-400 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-navy-50 px-4 py-3 text-sm font-bold text-navy-800 marker:hidden transition hover:bg-star-50">
        <span>{title}</span>
        <span className="text-xs text-star-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-navy-100 bg-white px-4 py-1">{children}</div>
    </details>
  );
}

export function ProspectInfoSidebar({
  prospect,
  ownerName,
  sourceName,
  champsPerso,
}: {
  prospect: Prospect;
  ownerName: string | null;
  sourceName: string | null;
  champsPerso: Array<{ cle: string; libelle: string }>;
}) {
  const p = prospect;
  const champs = champsPerso
    .map((c) => ({ ...c, value: p.champs_perso?.[c.cle] }))
    .filter((c) => c.value);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-navy-800 px-4 py-3 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-star-500" />
          <h2 className="font-display text-sm font-bold">Informations</h2>
        </div>
        <p className="mt-1 text-[11px] text-navy-200">Clique directement sur une valeur pour la modifier</p>
      </div>

      <Panel title="Suivi commercial">
        <dl>
          <InfoRow label="Étape"><span className="text-xs font-semibold text-navy-800">{valeur(p.stage)}</span></InfoRow>
          <InfoRow label="Prochaine action"><EditableField prospectId={p.id} field="next_action" value={p.next_action} /></InfoRow>
          <InfoRow label="Date de relance"><EditableField prospectId={p.id} field="next_action_date" value={p.next_action_date} type="date" /></InfoRow>
          <InfoRow label="Score"><EditableField prospectId={p.id} field="score" value={p.score} type="number" suffix="/5" /></InfoRow>
          <InfoRow label="Commercial"><span className="text-xs font-semibold text-navy-800">{valeur(ownerName)}</span></InfoRow>
          <InfoRow label="Source"><span className="text-xs font-semibold text-navy-800">{valeur(sourceName)}</span></InfoRow>
        </dl>
      </Panel>

      <Panel title="Contact">
        <dl>
          <InfoRow label="Prénom"><EditableField prospectId={p.id} field="prenom" value={p.prenom} /></InfoRow>
          <InfoRow label="Nom"><EditableField prospectId={p.id} field="nom" value={p.nom} /></InfoRow>
          <InfoRow label="Email"><EditableField prospectId={p.id} field="mail" value={p.mail} type="email" /></InfoRow>
          <InfoRow label="Mobile"><EditableField prospectId={p.id} field="tel_mobile" value={p.tel_mobile} type="tel" /></InfoRow>
          <InfoRow label="Fixe"><EditableField prospectId={p.id} field="tel_fixe" value={p.tel_fixe} type="tel" /></InfoRow>
        </dl>
      </Panel>

      <Panel title="Énergie & contrat">
        <dl>
          <InfoRow label="Fournisseur élec"><EditableField prospectId={p.id} field="fournisseur_electricite" value={p.fournisseur_electricite} /></InfoRow>
          <InfoRow label="Fournisseur gaz"><EditableField prospectId={p.id} field="fournisseur_gaz" value={p.fournisseur_gaz} /></InfoRow>
          <InfoRow label="PDL"><EditableField prospectId={p.id} field="pdl" value={p.pdl} /></InfoRow>
          <InfoRow label="PCE"><EditableField prospectId={p.id} field="pce" value={p.pce} /></InfoRow>
          <InfoRow label="CAR élec"><EditableField prospectId={p.id} field="car_electricite" value={p.car_electricite} type="number" suffix=" MWh" /></InfoRow>
          <InfoRow label="CAR gaz"><EditableField prospectId={p.id} field="car_gaz" value={p.car_gaz} type="number" suffix=" MWh" /></InfoRow>
          <InfoRow label="Option tarifaire"><EditableField prospectId={p.id} field="option_tarifaire" value={p.option_tarifaire} /></InfoRow>
          <InfoRow label="Fin de contrat"><EditableField prospectId={p.id} field="date_fin_contrat" value={p.date_fin_contrat} type="date" /></InfoRow>
        </dl>
      </Panel>

      <Panel title="Entreprise" open={false}>
        <dl>
          <InfoRow label="Raison sociale"><EditableField prospectId={p.id} field="raison_sociale" value={p.raison_sociale} /></InfoRow>
          <InfoRow label="SIREN"><EditableField prospectId={p.id} field="siren" value={p.siren} /></InfoRow>
          <InfoRow label="NAF"><EditableField prospectId={p.id} field="naf" value={p.naf} /></InfoRow>
          <InfoRow label="Code postal"><EditableField prospectId={p.id} field="code_postal" value={p.code_postal} /></InfoRow>
          <InfoRow label="Segment"><EditableField prospectId={p.id} field="segment" value={p.segment} /></InfoRow>
          <InfoRow label="Nombre de sites"><EditableField prospectId={p.id} field="nb_sites" value={p.nb_sites} type="number" /></InfoRow>
        </dl>
      </Panel>

      {champs.length ? (
        <Panel title="Informations personnalisées" open={false}>
          <dl>{champs.map((c) => <InfoRow key={c.cle} label={c.libelle}><span className="text-xs font-semibold text-navy-800">{valeur(c.value)}</span></InfoRow>)}</dl>
        </Panel>
      ) : null}
    </div>
  );
}
