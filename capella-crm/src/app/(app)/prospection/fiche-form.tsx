"use client";

import { useActionState } from "react";
import { creerProspect, enregistrerFiche } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { PROSPECT_STAGES, FOURNISSEURS } from "@/lib/domain/stages";
import type { Prospect } from "@/lib/domain/database.types";

type Option = { value: string; label: string };

/**
 * Une seule fiche pour créer et pour modifier : les champs, les libellés et
 * les règles restent forcément identiques dans les deux cas.
 */
export function FicheForm({
  prospect,
  sources,
  commerciaux,
  estAdmin,
  champsPerso = [],
}: {
  prospect?: Prospect;
  sources: Option[];
  commerciaux: Option[];
  estAdmin: boolean;
  /** Champs personnalisés à afficher (définitions), avec leurs valeurs. */
  champsPerso?: { cle: string; libelle: string }[];
}) {
  const enCreation = !prospect;
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    enCreation ? creerProspect : enregistrerFiche,
    null,
  );

  const classeSelect =
    "h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/20";

  return (
    <form action={action} className="space-y-6">
      {prospect ? <input type="hidden" name="id" value={prospect.id} /> : null}

      <Card>
        <CardHeader title="Entreprise" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Raison sociale">
            <Input name="raison_sociale" defaultValue={prospect?.raison_sociale ?? ""} />
          </Field>
          <Field label="SIREN">
            <Input name="siren" defaultValue={prospect?.siren ?? ""} inputMode="numeric" />
          </Field>
          <Field label="Code NAF">
            <Input name="naf" defaultValue={prospect?.naf ?? ""} />
          </Field>
          <Field label="Code postal">
            <Input name="code_postal" defaultValue={prospect?.code_postal ?? ""} />
          </Field>
          <Field label="Segment">
            <Input name="segment" defaultValue={prospect?.segment ?? ""} placeholder="Restauration, industrie…" />
          </Field>
          <Field label="Nombre de sites">
            <Input name="nb_sites" type="number" min={0} defaultValue={prospect?.nb_sites ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Contact" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nom">
            <Input name="nom" defaultValue={prospect?.nom ?? ""} />
          </Field>
          <Field label="Prénom">
            <Input name="prenom" defaultValue={prospect?.prenom ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="mail" type="email" defaultValue={prospect?.mail ?? ""} />
          </Field>
          <Field label="Téléphone mobile">
            <Input name="tel_mobile" defaultValue={prospect?.tel_mobile ?? ""} inputMode="tel" />
          </Field>
          <Field label="Téléphone fixe">
            <Input name="tel_fixe" defaultValue={prospect?.tel_fixe ?? ""} inputMode="tel" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Énergie" hint="Ce qui sert à construire le comparatif." />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="PDL (électricité)">
            <Input name="pdl" defaultValue={prospect?.pdl ?? ""} inputMode="numeric" />
          </Field>
          <Field label="PCE (gaz)">
            <Input name="pce" defaultValue={prospect?.pce ?? ""} inputMode="numeric" />
          </Field>
          <Field label="CAR Électricité (MWh)">
            <Input
              name="car_electricite"
              defaultValue={prospect?.car_electricite ?? ""}
              inputMode="decimal"
              placeholder="120"
            />
          </Field>
          <Field label="CAR Gaz (MWh)">
            <Input
              name="car_gaz"
              defaultValue={prospect?.car_gaz ?? ""}
              inputMode="decimal"
              placeholder="0"
            />
          </Field>
          <Field label="Option tarifaire">
            <Input name="option_tarifaire" defaultValue={prospect?.option_tarifaire ?? ""} />
          </Field>
          <Field label="Fournisseur Élec">
            <select
              name="fournisseur_electricite"
              defaultValue={prospect?.fournisseur_electricite ?? ""}
              className={classeSelect}
            >
              <option value="">—</option>
              {FOURNISSEURS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fournisseur Gaz">
            <select
              name="fournisseur_gaz"
              defaultValue={prospect?.fournisseur_gaz ?? ""}
              className={classeSelect}
            >
              <option value="">—</option>
              {FOURNISSEURS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Date de fin de contrat"
            hint="Obligatoire pour l'étape « DFF trop éloigné »."
          >
            <Input
              name="date_fin_contrat"
              type="date"
              defaultValue={prospect?.date_fin_contrat ?? ""}
            />
          </Field>
        </div>
      </Card>

      {champsPerso.length > 0 ? (
        <Card>
          <CardHeader
            title="Champs personnalisés"
            hint="Les informations propres à ton activité."
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
            {champsPerso.map((c) => (
              <Field key={c.cle} label={c.libelle}>
                <Input
                  name={`perso_${c.cle}`}
                  defaultValue={prospect?.champs_perso?.[c.cle] ?? ""}
                />
              </Field>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Suivi commercial" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Étape">
            <select
              name="stage"
              defaultValue={prospect?.stage ?? "NRP"}
              className={classeSelect}
            >
              {PROSPECT_STAGES.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prochaine action">
            <Input name="next_action" defaultValue={prospect?.next_action ?? ""} />
          </Field>
          <Field label="Date de la prochaine action">
            <Input
              name="next_action_date"
              type="date"
              defaultValue={prospect?.next_action_date ?? ""}
            />
          </Field>
          <Field label="Score" hint="De 0 à 5, ton ressenti sur le potentiel.">
            <Input name="score" type="number" min={0} max={5} defaultValue={prospect?.score ?? ""} />
          </Field>
          <Field label="Source">
            <select
              name="source_id"
              defaultValue={prospect?.source_id ?? ""}
              className={classeSelect}
            >
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          {estAdmin && enCreation ? (
            <Field
              label="Attribuer à"
              hint="Laisse vide pour envoyer le prospect au réservoir."
            >
              <select name="assigned_to" defaultValue="" className={classeSelect}>
                <option value="">— Réservoir —</option>
                {commerciaux.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
        <div className="px-5 pb-5">
          <Field label="Notes">
            <textarea
              name="notes"
              rows={4}
              defaultValue={prospect?.notes ?? ""}
              className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/20"
            />
          </Field>
        </div>
      </Card>

      {etat && !etat.ok ? (
        <p
          role="alert"
          className="rounded-lg px-3 py-2 text-sm text-navy-800"
          style={{ backgroundColor: "var(--color-status-perdu)" }}
        >
          {etat.message}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={enCours}>
          {enCours
            ? "Enregistrement…"
            : enCreation
              ? "Créer le prospect"
              : "Enregistrer la fiche"}
        </Button>
        {etat?.ok ? (
          <span
            className="rounded-lg px-3 py-1.5 text-sm text-navy-800"
            style={{ backgroundColor: "var(--color-status-signe)" }}
          >
            {etat.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
