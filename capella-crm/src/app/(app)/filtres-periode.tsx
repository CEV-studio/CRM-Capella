"use client";

import { CalendarRange, Filter } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MOIS } from "@/lib/format";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/** Filtres partagés par le tableau de bord et les commissions. */
export function FiltresPeriode({ chemin, annees, commerciaux, apporteurs }: {
  chemin: string;
  annees: number[];
  commerciaux: Option[];
  apporteurs: Option[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [enCours, startTransition] = useTransition();

  function maj(cle: string, valeur: string) {
    const p = new URLSearchParams(params.toString());
    if (valeur) p.set(cle, valeur); else p.delete(cle);
    startTransition(() => router.push(`${chemin}?${p.toString()}`));
  }

  const classe = "h-10 rounded-xl border border-navy-200 bg-white px-3 text-sm text-navy-700 shadow-sm focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/10";
  const anneeCourante = String(annees[0] ?? new Date().getFullYear());

  return (
    <div className={cn("flex flex-wrap items-center gap-2.5 rounded-2xl border border-navy-100 bg-white p-3 shadow-[var(--crm-shadow-sm)]", enCours && "opacity-60")}>
      <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-grey-brand"><Filter size={13}/> Filtres</span>
      <div className="relative">
        <CalendarRange size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"/>
        <select className={`${classe} pl-8`} value={params.get("annee") ?? anneeCourante} onChange={(e) => maj("annee", e.currentTarget.value)} aria-label="Année">
          {annees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <select className={classe} value={params.get("mois") ?? ""} onChange={(e) => maj("mois", e.currentTarget.value)} aria-label="Mois">
        <option value="">Toute l&apos;année</option>
        {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      {commerciaux.length > 0 ? <select className={classe} value={params.get("commercial") ?? ""} onChange={(e) => maj("commercial", e.currentTarget.value)} aria-label="Commercial"><option value="">Tous les commerciaux</option>{commerciaux.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select> : null}
      {apporteurs.length > 0 ? <select className={classe} value={params.get("apporteur") ?? ""} onChange={(e) => maj("apporteur", e.currentTarget.value)} aria-label="Apporteur"><option value="">Tous les apporteurs</option>{apporteurs.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select> : null}
    </div>
  );
}
