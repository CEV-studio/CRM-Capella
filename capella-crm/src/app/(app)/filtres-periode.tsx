"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MOIS } from "@/lib/format";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/**
 * Filtres partagés par le tableau de bord et les commissions.
 * Tout passe par l'URL : une vue filtrée se partage et se recharge.
 */
export function FiltresPeriode({
  chemin,
  annees,
  commerciaux,
  apporteurs,
}: {
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
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    startTransition(() => router.push(`${chemin}?${p.toString()}`));
  }

  const classe =
    "h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm focus:border-star-500 focus:outline-none";

  const anneeCourante = String(annees[0] ?? new Date().getFullYear());

  return (
    <div className={cn("flex flex-wrap items-center gap-2", enCours && "opacity-60")}>
      <select
        className={classe}
        value={params.get("annee") ?? anneeCourante}
        onChange={(e) => maj("annee", e.currentTarget.value)}
        aria-label="Année"
      >
        {annees.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      <select
        className={classe}
        value={params.get("mois") ?? ""}
        onChange={(e) => maj("mois", e.currentTarget.value)}
        aria-label="Mois"
      >
        <option value="">Toute l&apos;année</option>
        {MOIS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>

      {commerciaux.length > 0 ? (
        <select
          className={classe}
          value={params.get("commercial") ?? ""}
          onChange={(e) => maj("commercial", e.currentTarget.value)}
          aria-label="Commercial"
        >
          <option value="">Tous les commerciaux</option>
          {commerciaux.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      ) : null}

      {apporteurs.length > 0 ? (
        <select
          className={classe}
          value={params.get("apporteur") ?? ""}
          onChange={(e) => maj("apporteur", e.currentTarget.value)}
          aria-label="Apporteur"
        >
          <option value="">Tous les apporteurs</option>
          {apporteurs.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
