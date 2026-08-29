"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { PROSPECTION_STAGES } from "@/lib/domain/stages";
import { modifierVuesRapides } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

export function Filtres({ commerciaux, sources, total, vuesRapides, peutPersonnaliser }: {
  commerciaux: Option[]; sources: Option[]; total: number; vuesRapides: string[]; peutPersonnaliser: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [enCours, startTransition] = useTransition();
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  function majParam(cle: string, valeur: string) { const p = new URLSearchParams(params.toString()); valeur ? p.set(cle, valeur) : p.delete(cle); p.delete("page"); startTransition(() => router.push(`/prospection?${p.toString()}`)); }
  const etapeActive = params.get("etape") ?? "";
  const classeSelect = "h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm text-navy-700 shadow-sm focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/10";

  return <div className={cn("rounded-2xl border border-navy-100 bg-white p-3 shadow-[var(--crm-shadow-sm)] sm:p-4", enCours && "opacity-60")}>
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-64 flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" aria-hidden />
        <input type="search" defaultValue={params.get("q") ?? ""} onChange={e => { const v = e.currentTarget.value; if (minuteur.current) clearTimeout(minuteur.current); minuteur.current = setTimeout(() => majParam("q", v), 350); }} placeholder="Rechercher : société, nom, SIREN, téléphone…" className="h-10 w-full rounded-xl border border-navy-200 bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-navy-300 focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/10" />
      </div>
      <select className={classeSelect} value={params.get("etape") ?? ""} onChange={e => majParam("etape", e.currentTarget.value)}><option value="">Toutes les étapes</option>{PROSPECTION_STAGES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}</select>
      {commerciaux.length > 0 ? <select className={classeSelect} value={params.get("commercial") ?? ""} onChange={e => majParam("commercial", e.currentTarget.value)}><option value="">Tous les commerciaux</option><option value="reservoir">— Réservoir (non attribués) —</option>{commerciaux.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select> : null}
      <select className={classeSelect} value={params.get("source") ?? ""} onChange={e => majParam("source", e.currentTarget.value)}><option value="">Toutes les sources</option>{sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3 text-sm">
      <span className="mr-1 text-[11px] font-bold uppercase tracking-[.08em] text-grey-brand">Vues rapides</span>
      <button type="button" onClick={() => majParam("etape", "")} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-all", etapeActive === "" ? "border-navy-800 bg-navy-800 text-white shadow-sm" : "border-navy-200 bg-white text-navy-700 hover:border-navy-300 hover:bg-sky-capella-50")}>Tout</button>
      {vuesRapides.map(label => <button key={label} type="button" onClick={() => majParam("etape", label)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-all", etapeActive === label ? "border-navy-800 bg-navy-800 text-white shadow-sm" : "border-navy-200 bg-white text-navy-700 hover:border-navy-300 hover:bg-sky-capella-50")}>{label}</button>)}
      {peutPersonnaliser ? <Personnaliser actives={vuesRapides} /> : null}
      <span className="ml-auto rounded-full bg-navy-50 px-2.5 py-1 tabular text-xs font-semibold text-navy-600">{total} prospect{total > 1 ? "s" : ""}</span>
    </div>
  </div>;
}

function Personnaliser({ actives }: { actives: string[] }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(modifierVuesRapides, null);
  return <div className="relative">
    <button type="button" onClick={() => setOuvert(o => !o)} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy-300 bg-white px-3 py-1.5 text-xs font-semibold text-navy-600 hover:border-star-300 hover:bg-star-50 hover:text-star-700"><SlidersHorizontal size={13} /> Personnaliser</button>
    {ouvert ? <form action={action} className="absolute z-20 mt-2 w-72 rounded-xl border border-navy-200 bg-white p-4 shadow-[var(--crm-shadow-card)]">
      <div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-navy-800">Vues rapides</p><p className="mt-0.5 text-xs text-grey-brand">Étapes visibles sous les filtres.</p></div><button type="button" onClick={() => setOuvert(false)} className="rounded-lg p-1 text-grey-brand hover:bg-navy-50 hover:text-navy-800" aria-label="Fermer"><X size={15}/></button></div>
      <div className="max-h-64 space-y-1 overflow-y-auto">{PROSPECTION_STAGES.map(s => <label key={s.label} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-navy-50"><input type="checkbox" name="etapes" value={s.label} defaultChecked={actives.includes(s.label)} className="h-4 w-4 accent-[var(--color-star-500)]" />{s.label}</label>)}</div>
      <div className="mt-3 flex items-center gap-2 border-t border-navy-100 pt-3"><button type="submit" disabled={enCours} className="inline-flex h-9 items-center rounded-xl bg-star-500 px-3 text-xs font-semibold text-white shadow-sm hover:bg-star-600">{enCours ? "Enregistrement…" : "Enregistrer"}</button>{etat ? <span className="text-xs text-navy-700">{etat.message}</span> : null}</div>
    </form> : null}
  </div>;
}
