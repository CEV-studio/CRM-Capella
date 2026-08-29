"use client";

import { useState } from "react";
import { Mail, Phone, UserRound } from "lucide-react";

type Field = "prenom" | "nom" | "mail" | "tel_mobile" | "tel_fixe";

function InlineContactField({ prospectId, field, value, placeholder, type = "text" }: {
  prospectId: string;
  field: Field;
  value: string | null;
  placeholder: string;
  type?: "text" | "email" | "tel";
}) {
  const [current, setCurrent] = useState(value ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    if (draft === current) { setEditing(false); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/prospects/${prospectId}/inline`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field, value: draft }),
      });
      const data = await response.json() as { value?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      setCurrent(data.value == null ? "" : String(data.value));
      setDraft(data.value == null ? "" : String(data.value));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) return <input autoFocus type={type} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => void save()} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } if (e.key === "Escape") { setDraft(current); setEditing(false); } }} className="h-8 min-w-[130px] rounded-lg border border-sky-capella-300 bg-white px-2.5 text-xs font-semibold text-navy-900 outline-none focus:ring-2 focus:ring-sky-capella-100" placeholder={placeholder}/>;

  return <button type="button" onClick={() => { setDraft(current); setEditing(true); }} className={`rounded-lg px-1.5 py-1 text-left text-sm transition hover:bg-sky-capella-50 ${current ? "font-medium text-navy-800" : "font-medium text-navy-300"}`} title="Cliquer pour modifier">{saving ? "Enregistrement…" : current || placeholder}</button>;
}

export function ProspectContactHeader({ prospectId, prenom, nom, mail, mobile, fixe }: {
  prospectId: string;
  prenom: string | null;
  nom: string | null;
  mail: string | null;
  mobile: string | null;
  fixe: string | null;
}) {
  const phoneField: "tel_mobile" | "tel_fixe" = mobile ? "tel_mobile" : fixe ? "tel_fixe" : "tel_mobile";
  const phoneValue = mobile || fixe;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="inline-flex items-center gap-1 text-navy-500"><UserRound size={16} className="shrink-0 text-navy-400"/><InlineContactField prospectId={prospectId} field="prenom" value={prenom} placeholder="Ajouter prénom"/><InlineContactField prospectId={prospectId} field="nom" value={nom} placeholder="Ajouter nom"/></div>
      <div className="inline-flex items-center gap-1 text-navy-500"><Phone size={16} className="shrink-0 text-navy-400"/><InlineContactField prospectId={prospectId} field={phoneField} value={phoneValue} placeholder="Ajouter téléphone" type="tel"/></div>
      <div className="inline-flex min-w-0 items-center gap-1 text-navy-500"><Mail size={16} className="shrink-0 text-navy-400"/><InlineContactField prospectId={prospectId} field="mail" value={mail} placeholder="Ajouter e-mail" type="email"/></div>
    </div>
  );
}
