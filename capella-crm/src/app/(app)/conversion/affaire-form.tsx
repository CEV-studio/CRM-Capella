"use client";

import { useActionState } from "react";
import { creerAffaire, enregistrerAffaire } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { AFFAIRE_STAGES, FOURNISSEURS, TYPES_ENERGIE } from "@/lib/domain/stages";
import type { Affaire } from "@/lib/domain/database.types";

type Option = { value: string; label: string };

const SELECT =
  "h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/20";

export function AffaireForm({
  affaire,
  prefill,
  commerciaux,
  apporteurs,
  estAdmin,
}: {
  affaire?: Affaire;
  /** Valeurs pré-remplies lors d'une bascule depuis un prospect. */
  prefill?: Partial<Affaire> & { prospect_id?: string; source_id?: string | null };
  commerciaux: Option[];
  apporteurs: Option[];
  estAdmin: boolean;
}) {
  const enCreation = !affaire;
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    enCreation ? creerAffaire : enregistrerAffaire,
    null,
  );

  const v = affaire ?? (prefill as Partial<Affaire> | undefined);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-6">
      {affaire ? <input type="hidden" name="id" value={affaire.id} /> : null}
      {prefill?.prospect_id ? (
        <input type="hidden" name="prospect_id" value={prefill.prospect_id} />
      ) : null}
      {prefill?.source_id ? (
        <input type="hidden" name="source_id" value={prefill.source_id} />
      ) : null}

      <Card>
        <CardHeader title="Client" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Raison sociale">
            <Input name="raison_sociale" required defaultValue={v?.raison_sociale ?? ""} />
          </Field>
          <Field label="SIREN">
            <Input name="siren" defaultValue={v?.siren ?? ""} inputMode="numeric" />
          </Field>
          <Field label="Adresse de consommation">
            <Input name="adresse_conso" defaultValue={v?.adresse_conso ?? ""} />
          </Field>
          <Field label="Nom du dirigeant">
            <Input name="nom" defaultValue={v?.nom ?? ""} />
          </Field>
          <Field label="Prénom du dirigeant">
            <Input name="prenom" defaultValue={v?.prenom ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="mail" type="email" defaultValue={v?.mail ?? ""} />
          </Field>
          <Field label="Téléphone">
            <Input name="telephone" defaultValue={v?.telephone ?? ""} inputMode="tel" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Contrat" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Fournisseur">
            <select name="fournisseur" defaultValue={v?.fournisseur ?? ""} className={SELECT}>
              <option value="">—</option>
              {FOURNISSEURS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type d'énergie">
            <select name="type_energie" defaultValue={v?.type_energie ?? ""} className={SELECT}>
              <option value="">—</option>
              {TYPES_ENERGIE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contrat">
            <Input name="contrat" defaultValue={v?.contrat ?? ""} placeholder="Référence, durée…" />
          </Field>
          <Field label="PDL Élec">
            <Input name="pdl_elec" defaultValue={v?.pdl_elec ?? ""} inputMode="numeric" />
          </Field>
          <Field label="PCE Gaz">
            <Input name="pce_gaz" defaultValue={v?.pce_gaz ?? ""} />
          </Field>
          <Field label="CAR (MWh)">
            <Input name="car_mwh" defaultValue={v?.car_mwh ?? ""} inputMode="decimal" />
          </Field>
          <Field label="Date de début">
            <Input name="date_debut" type="date" defaultValue={v?.date_debut ?? ""} />
          </Field>
          <Field label="Date d'échéance">
            <Input name="date_echeance" type="date" defaultValue={v?.date_echeance ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Suivi et rémunération"
          hint="La date de signature se remplit toute seule au passage à « Signé »."
        />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Étape">
            <select name="stage" defaultValue={v?.stage ?? "Demande de cotation"} className={SELECT}>
              {AFFAIRE_STAGES.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          {estAdmin && enCreation ? (
            <Field label="Commercial">
              <select name="commercial_id" defaultValue="" className={SELECT}>
                <option value="">— Moi —</option>
                {commerciaux.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Apporteur d'affaires">
            <select name="apporteur_id" defaultValue={v?.apporteur_id ?? ""} className={SELECT}>
              <option value="">— Aucun —</option>
              {apporteurs.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Commission (€)">
            <Input name="commission" defaultValue={v?.commission ?? ""} inputMode="decimal" />
          </Field>
          <Field label="Date d'entrée">
            <Input name="date_entree" type="date" defaultValue={v?.date_entree ?? aujourdhui} />
          </Field>
          <Field label="Date de signature" hint="Laisse vide : elle se remplit seule.">
            <Input name="date_signature" type="date" defaultValue={v?.date_signature ?? ""} />
          </Field>
          <Field label="Date de relance">
            <Input name="date_relance" type="date" defaultValue={v?.date_relance ?? ""} />
          </Field>
        </div>
        <div className="px-5 pb-5">
          <Field label="Notes">
            <textarea
              name="notes"
              rows={4}
              defaultValue={v?.notes ?? ""}
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
              ? "Créer l'affaire"
              : "Enregistrer l'affaire"}
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
