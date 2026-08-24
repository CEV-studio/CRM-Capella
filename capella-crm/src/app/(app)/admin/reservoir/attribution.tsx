"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  attribuerSelection,
  attribuerSource,
  creerChampPersonnalise,
  creerSource,
  reattribuer,
} from "./actions";
import { TYPES_SOURCE } from "@/lib/domain/sources";
import type { ActionResult } from "@/lib/action-result";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { nomComplet } from "@/lib/domain/noms";
import type { Prospect } from "@/lib/domain/database.types";

type Option = { value: string; label: string };
export type LeadReservoir = Prospect & { source?: string | null };

const SELECT =
  "h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/20";

function Message({ etat }: { etat: ActionResult | null }) {
  if (!etat) return null;
  return (
    <span
      role="status"
      className="rounded-lg px-3 py-1.5 text-sm text-navy-800"
      style={{
        backgroundColor: etat.ok
          ? "var(--color-status-signe)"
          : "var(--color-status-perdu)",
      }}
    >
      {etat.message}
    </span>
  );
}

/** Création d'une source (canal d'acquisition) : un nom + un type. */
export function NouvelleSource() {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    creerSource,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // On vide le formulaire après une création réussie.
  useEffect(() => {
    if (etat?.ok) formRef.current?.reset();
  }, [etat]);

  return (
    <Card>
      <CardHeader
        title="Nouvelle source"
        hint="Ajoute un canal d'acquisition. Il apparaîtra ensuite partout où l'on choisit une source."
      />
      <form ref={formRef} action={action} className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom">
            <Input name="name" required placeholder="Ex. Salon Energaïa 2026" />
          </Field>
          <Field label="Type">
            <select name="kind" required defaultValue="" className={SELECT}>
              <option value="" disabled>
                — Choisis un type —
              </option>
              {TYPES_SOURCE.map((t) => (
                <option key={t.valeur} value={t.valeur}>
                  {t.libelle}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={enCours}>
            {enCours ? "Création…" : "+ Créer la source"}
          </Button>
          <Message etat={etat} />
        </div>
      </form>
    </Card>
  );
}

/** Création d'un champ personnalisé (réutilisable sur les fiches + à l'import). */
export function NouveauChampPerso({
  champs,
}: {
  champs: { cle: string; libelle: string }[];
}) {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    creerChampPersonnalise,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat?.ok) formRef.current?.reset();
  }, [etat]);

  return (
    <Card>
      <CardHeader
        title="Champs personnalisés"
        hint="Ajoute une information propre à ton activité (ex. « Marge souhaitée »). Elle apparaîtra sur chaque fiche prospect et pourra recevoir une colonne à l'import."
      />
      <div className="space-y-4 px-5 py-4">
        {champs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {champs.map((c) => (
              <span
                key={c.cle}
                className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-700"
              >
                {c.libelle}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-grey-brand">Aucun champ pour l&apos;instant.</p>
        )}

        <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
          <div className="grow">
            <Field label="Nom du champ">
              <Input name="libelle" required placeholder="Ex. Marge souhaitée" />
            </Field>
          </div>
          <Button type="submit" disabled={enCours}>
            {enCours ? "Création…" : "+ Créer le champ"}
          </Button>
          <Message etat={etat} />
        </form>
      </div>
    </Card>
  );
}

/** Attribution d'un lot entier, par source. */
export function AttributionParSource({
  sources,
  commerciaux,
}: {
  sources: (Option & { disponibles: number })[];
  commerciaux: Option[];
}) {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    attribuerSource,
    null,
  );

  return (
    <Card>
      <CardHeader
        title="Attribuer un lot"
        hint="Le plus rapide : tout un canal d'un coup, ou seulement les X premiers."
      />
      <form action={action} className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Source">
            <select name="source_id" required defaultValue="" className={SELECT}>
              <option value="" disabled>
                — Choisis une source —
              </option>
              {sources.map((s) => (
                <option key={s.value} value={s.value} disabled={s.disponibles === 0}>
                  {s.label} ({s.disponibles} dispo)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Attribuer à">
            <select name="commercial" required defaultValue="" className={SELECT}>
              <option value="" disabled>
                — Choisis un commercial —
              </option>
              {commerciaux.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Combien ?" hint="Vide = tous les leads disponibles.">
            <Input name="limite" type="number" min={1} placeholder="Tous" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={enCours}>
            {enCours ? "Attribution…" : "Attribuer le lot"}
          </Button>
          <Message etat={etat} />
        </div>
      </form>
    </Card>
  );
}

/** Réservoir ligne à ligne, avec sélection multiple. */
export function TableauReservoir({
  leads,
  commerciaux,
  total,
}: {
  leads: LeadReservoir[];
  commerciaux: Option[];
  total: number;
}) {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    attribuerSelection,
    null,
  );
  const [selection, setSelection] = useState<Set<string>>(new Set());

  function basculer(id: string) {
    setSelection((s) => {
      const suivant = new Set(s);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  const toutCoche = leads.length > 0 && selection.size === leads.length;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Réservoir"
        hint={`${total} lead(s) en attente d'attribution. Toi seul les vois.`}
      />

      <form action={action}>
        <div className="flex flex-wrap items-center gap-3 border-b border-navy-100 px-5 py-3">
          <select name="commercial" required defaultValue="" className={`${SELECT} w-56`}>
            <option value="" disabled>
              — Attribuer la sélection à —
            </option>
            {commerciaux.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={enCours || selection.size === 0}>
            {enCours ? "…" : `Attribuer ${selection.size} lead(s)`}
          </Button>
          <Message etat={etat} />
        </div>

        <div className="scroll-slim max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead className="sticky top-0 bg-navy-800">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={toutCoche}
                    onChange={(e) =>
                      setSelection(
                        e.currentTarget.checked
                          ? new Set(leads.map((l) => l.id))
                          : new Set(),
                      )
                    }
                    className="h-4 w-4 accent-[var(--color-star-500)]"
                    aria-label="Tout sélectionner"
                  />
                </th>
                {["Société", "Contact", "Mobile", "SIREN", "Source", "Reçu le"].map(
                  (t) => (
                    <th
                      key={t}
                      className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-navy-300"
                    >
                      {t}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-grey-brand">
                    Le réservoir est vide. Importe un fichier ci-dessus.
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr key={l.id} className="border-b border-navy-100 hover:bg-navy-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        name="ids"
                        value={l.id}
                        checked={selection.has(l.id)}
                        onChange={() => basculer(l.id)}
                        className="h-4 w-4 accent-[var(--color-star-500)]"
                        aria-label={`Sélectionner ${l.raison_sociale ?? "ce lead"}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-navy-800">
                      {l.raison_sociale || nomComplet(l.nom, l.prenom)}
                      <div className="tabular text-[11px] text-grey-brand">{l.ref}</div>
                    </td>
                    <td className="px-3 py-2 text-navy-700">{nomComplet(l.nom, l.prenom, "—")}</td>
                    <td className="tabular px-3 py-2 whitespace-nowrap text-navy-700">
                      {l.tel_mobile || "—"}
                    </td>
                    <td className="tabular px-3 py-2 text-navy-700">{l.siren || "—"}</td>
                    <td className="px-3 py-2 text-xs text-grey-brand">{l.source ?? "—"}</td>
                    <td className="tabular px-3 py-2 text-xs text-grey-brand">
                      {fmtDate(l.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </form>
    </Card>
  );
}

/** Vider le portefeuille d'un commercial vers un autre. */
export function Reattribution({ commerciaux }: { commerciaux: Option[] }) {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    reattribuer,
    null,
  );

  return (
    <Card>
      <CardHeader
        title="Réattribuer un portefeuille"
        hint="Quand quelqu'un part : ses prospects et ses affaires changent de main, rien n'est perdu."
      />
      <form action={action} className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reprendre le portefeuille de">
            <select name="depuis" required defaultValue="" className={SELECT}>
              <option value="" disabled>
                — Choisis un commercial —
              </option>
              {commerciaux.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Le donner à"
            hint="« Réservoir » ne déplace que les prospects : une affaire garde toujours un commercial."
          >
            <select name="vers" defaultValue="" className={SELECT}>
              <option value="">— Réservoir —</option>
              {commerciaux.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={enCours}>
            {enCours ? "Transfert…" : "Transférer le portefeuille"}
          </Button>
          <Message etat={etat} />
        </div>
      </form>
    </Card>
  );
}
