"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changerEtapeAffaire } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { MenuEtape } from "@/components/menu-etape";
import { AFFAIRE_STAGES, stageColor } from "@/lib/domain/stages";
import { fmtDate, fmtEuros } from "@/lib/format";
import type { Affaire } from "@/lib/domain/database.types";

export type CarteAffaire = Affaire & {
  commercial?: string | null;
  apporteur?: string | null;
};

export function Carte({
  a,
  afficherCommercial,
}: {
  a: CarteAffaire;
  afficherCommercial: boolean;
}) {
  const [etat, action] = useActionState<ActionResult | null, FormData>(
    changerEtapeAffaire,
    null,
  );

  const relanceDepassee =
    a.date_relance != null && new Date(a.date_relance) < new Date();

  return (
    <li className="rounded-lg border border-navy-100 bg-white p-3 shadow-sm">
      <Link
        href={`/conversion/${a.id}`}
        className="block truncate text-sm font-semibold text-navy-800 hover:text-star-600"
        title={a.raison_sociale}
      >
        {a.raison_sociale}
      </Link>

      <div className="tabular mt-0.5 text-[11px] text-grey-brand">
        {a.ref}
        {a.type_energie ? ` · ${a.type_energie}` : ""}
      </div>

      <div className="mt-2">
        <MenuEtape
          id={a.id}
          etapeEnBase={a.stage}
          etapes={AFFAIRE_STAGES}
          couleur={(e) => stageColor(e, "affaire")}
          action={action}
          resultat={etat}
          libelle={`Étape de ${a.raison_sociale}`}
        />
      </div>

      <dl className="mt-2 space-y-0.5 text-[11px] text-navy-700">
        {a.commission > 0 ? (
          <div className="flex justify-between gap-2">
            <dt className="text-grey-brand">Commission</dt>
            <dd className="tabular font-semibold">{fmtEuros(a.commission)}</dd>
          </div>
        ) : null}
        {a.date_signature ? (
          <div className="flex justify-between gap-2">
            <dt className="text-grey-brand">Signée le</dt>
            <dd className="tabular">{fmtDate(a.date_signature)}</dd>
          </div>
        ) : null}
        {a.date_relance ? (
          <div className="flex justify-between gap-2">
            <dt className="text-grey-brand">Relance</dt>
            <dd className={relanceDepassee ? "tabular font-semibold text-star-600" : "tabular"}>
              {fmtDate(a.date_relance)}
            </dd>
          </div>
        ) : null}
        {afficherCommercial && a.commercial ? (
          <div className="flex justify-between gap-2">
            <dt className="text-grey-brand">Commercial</dt>
            <dd className="truncate">{a.commercial}</dd>
          </div>
        ) : null}
        {a.apporteur ? (
          <div className="flex justify-between gap-2">
            <dt className="text-grey-brand">Apporteur</dt>
            <dd className="truncate">{a.apporteur}</dd>
          </div>
        ) : null}
      </dl>

      {etat && !etat.ok ? (
        <p
          role="alert"
          className="mt-2 rounded px-2 py-1 text-[11px] text-navy-800"
          style={{ backgroundColor: "var(--color-status-perdu)" }}
        >
          {etat.message}
        </p>
      ) : null}
    </li>
  );
}
