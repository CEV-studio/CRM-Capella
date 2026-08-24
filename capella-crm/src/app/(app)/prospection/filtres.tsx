"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { PROSPECT_STAGES } from "@/lib/domain/stages";
import { modifierVuesRapides } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/**
 * Filtres de la liste. Tout passe par l'URL : la vue est partageable,
 * rechargeable, et le tri survit à un aller-retour sur une fiche.
 */
export function Filtres({
  commerciaux,
  sources,
  total,
  vuesRapides,
  peutPersonnaliser,
}: {
  commerciaux: Option[];
  sources: Option[];
  total: number;
  /** Libellés des étapes marquées comme vues rapides. */
  vuesRapides: string[];
  peutPersonnaliser: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [enCours, startTransition] = useTransition();
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  function majParam(cle: string, valeur: string) {
    const p = new URLSearchParams(params.toString());
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    p.delete("page");
    startTransition(() => router.push(`/prospection?${p.toString()}`));
  }

  const etapeActive = params.get("etape") ?? "";
  const classeSelect =
    "h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm focus:border-star-500 focus:outline-none";

  return (
    <div className={cn("space-y-3", enCours && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => {
            // On attend une pause de frappe avant de relancer la requête.
            const v = e.currentTarget.value;
            if (minuteur.current) clearTimeout(minuteur.current);
            minuteur.current = setTimeout(() => majParam("q", v), 350);
          }}
          placeholder="Rechercher : société, nom, SIREN, téléphone…"
          className="h-9 min-w-64 flex-1 rounded-lg border border-navy-200 bg-white px-3 text-sm placeholder:text-navy-300 focus:border-star-500 focus:outline-none"
        />

        <select
          className={classeSelect}
          value={params.get("etape") ?? ""}
          onChange={(e) => majParam("etape", e.currentTarget.value)}
        >
          <option value="">Toutes les étapes</option>
          {PROSPECT_STAGES.map((s) => (
            <option key={s.label} value={s.label}>
              {s.label}
            </option>
          ))}
        </select>

        {commerciaux.length > 0 ? (
          <select
            className={classeSelect}
            value={params.get("commercial") ?? ""}
            onChange={(e) => majParam("commercial", e.currentTarget.value)}
          >
            <option value="">Tous les commerciaux</option>
            <option value="reservoir">— Réservoir (non attribués) —</option>
            {commerciaux.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        ) : null}

        <select
          className={classeSelect}
          value={params.get("source") ?? ""}
          onChange={(e) => majParam("source", e.currentTarget.value)}
        >
          <option value="">Toutes les sources</option>
          {sources.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-grey-brand">Vues rapides :</span>
        <button
          type="button"
          onClick={() => majParam("etape", "")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            etapeActive === ""
              ? "bg-navy-800 text-white"
              : "bg-white text-navy-700 hover:bg-navy-100 border border-navy-200",
          )}
        >
          Tout
        </button>
        {vuesRapides.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => majParam("etape", label)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              etapeActive === label
                ? "bg-navy-800 text-white"
                : "bg-white text-navy-700 hover:bg-navy-100 border border-navy-200",
            )}
          >
            {label}
          </button>
        ))}
        {vuesRapides.length === 0 ? (
          <span className="text-xs text-grey-brand">
            aucune — {peutPersonnaliser ? "personnalise ci-contre" : "à définir par l'admin"}
          </span>
        ) : null}
        {peutPersonnaliser ? <Personnaliser actives={vuesRapides} /> : null}
        <span className="ml-auto tabular text-xs text-grey-brand">
          {total} prospect{total > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

/** Popover admin : cocher les étapes qui servent de vues rapides. */
function Personnaliser({ actives }: { actives: string[] }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    modifierVuesRapides,
    null,
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="rounded-full border border-dashed border-navy-300 px-3 py-1 text-xs font-semibold text-navy-600 hover:bg-navy-50"
      >
        ⚙ Personnaliser
      </button>
      {ouvert ? (
        <form
          action={action}
          className="absolute z-20 mt-2 w-64 rounded-lg border border-navy-200 bg-white p-3 shadow-lg"
        >
          <p className="mb-2 text-xs text-grey-brand">
            Coche les étapes à afficher comme boutons rapides.
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {PROSPECT_STAGES.map((s) => (
              <label key={s.label} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="etapes"
                  value={s.label}
                  defaultChecked={actives.includes(s.label)}
                  className="h-4 w-4 accent-[var(--color-star-500)]"
                />
                {s.label}
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={enCours}
              className="inline-flex h-8 items-center rounded-lg bg-star-500 px-3 text-xs font-semibold text-white hover:bg-star-600 disabled:opacity-60"
            >
              {enCours ? "…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="text-xs text-grey-brand underline underline-offset-2"
            >
              Fermer
            </button>
            {etat ? (
              <span className="text-xs text-navy-700">{etat.message}</span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
