"use client";

import { useActionState, useRef, useState } from "react";
import {
  analyserImport,
  confirmerImport,
  type Doublon,
  type ResultatAnalyse,
} from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { Button, Card, CardHeader, Field } from "@/components/ui";
import { COLONNES_IMPORT, ENTETES_IMPORT } from "@/lib/domain/import-template";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

function phraseDoublon(d: Doublon): string {
  const ou =
    d.ou === "fichier"
      ? `déjà présent plus haut dans le fichier (${d.detenteur})`
      : d.ou === "reservoir"
        ? `déjà dans ton réservoir (${d.refExistant})`
        : `déjà travaillé par ${d.detenteur} (${d.refExistant})`;
  return `${d.cle} ${d.valeur} — ${ou}`;
}

/**
 * Import en deux temps : on analyse d'abord, on écrit ensuite.
 * Rien n'est enregistré tant que Jeremy n'a pas vu le rapport de doublons.
 */
export function ImportForm({
  sources,
  commerciaux,
  champsPerso,
}: {
  sources: Option[];
  commerciaux: Option[];
  /** Champs personnalisés existants, proposés au rattachement des colonnes. */
  champsPerso: { cle: string; libelle: string }[];
}) {
  const [analyse, actionAnalyse, analyseEnCours] = useActionState<
    ResultatAnalyse | null,
    FormData
  >(analyserImport, null);

  const [ecriture, actionEcriture, ecritureEnCours] = useActionState<
    ActionResult | null,
    FormData
  >(confirmerImport, null);

  // Que faire des lignes en doublon : les écarter (défaut) ou les importer.
  const [garderDoublons, setGarderDoublons] = useState(false);
  const [nomFichier, setNomFichier] = useState<string | null>(null);

  // Rattachement manuel des colonnes inconnues : intitulé -> champ du CRM.
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const formAnalyse = useRef<HTMLFormElement>(null);

  const classeSelect =
    "h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/20";

  const rapport = analyse?.ok ? analyse : null;
  const valides = rapport?.lignes.filter((l) => !l.erreur) ?? [];
  const enErreur = rapport?.lignes.filter((l) => l.erreur) ?? [];
  const avecDoublon = valides.filter((l) => l.doublons.length > 0);
  const propres = valides.filter((l) => l.doublons.length === 0);
  const retenues = garderDoublons ? valides : propres;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Importer un fichier de leads"
          hint="Colonnes fixes : pars du modèle, colle tes données dedans."
        />

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a
              href="/admin/reservoir/modele"
              className="inline-flex h-10 items-center rounded-lg border border-navy-200 px-4 font-semibold text-navy-700 hover:bg-navy-50"
            >
              ↓ Télécharger le modèle CSV
            </a>
            <span className="text-grey-brand">
              {ENTETES_IMPORT.length} colonnes. Seule la raison sociale ou le nom
              est obligatoire.
            </span>
          </div>

          <form
            ref={formAnalyse}
            action={actionAnalyse}
            className="flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
            <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-navy-800 px-4 text-sm font-semibold text-white hover:bg-navy-700">
              Choisir un fichier
              <input
                type="file"
                name="fichier"
                accept=".csv,text/csv"
                required
                onChange={(e) => {
                  setNomFichier(e.currentTarget.files?.[0]?.name ?? null);
                  setMapping({});
                }}
                className="sr-only"
              />
            </label>
            <span className="text-sm text-navy-700">
              {nomFichier ?? "Aucun fichier sélectionné"}
            </span>
            <Button type="submit" variant="ghost" disabled={analyseEnCours || !nomFichier}>
              {analyseEnCours ? "Analyse…" : "Analyser le fichier"}
            </Button>
          </form>

          <p className="text-xs text-grey-brand">
            L&apos;analyse ne modifie rien. Elle te montre ce qui sera importé et
            ce qui existe déjà, avant que tu ne valides.
          </p>

          {analyse && !analyse.ok ? (
            <p
              role="alert"
              className="rounded-lg px-3 py-2 text-sm text-navy-800"
              style={{ backgroundColor: "var(--color-status-perdu)" }}
            >
              {analyse.message}
            </p>
          ) : null}
        </div>
      </Card>

      {rapport ? (
        <Card>
          <CardHeader
            title="Rapport d'analyse"
            hint="Rien n'est encore enregistré."
          />

          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "Lignes lues", valeur: rapport.lignes.length, fond: "var(--color-status-encours)" },
                { label: "Prêtes à importer", valeur: propres.length, fond: "var(--color-status-signe)" },
                { label: "Doublons détectés", valeur: avecDoublon.length, fond: "var(--color-status-relance)" },
                { label: "Lignes en erreur", valeur: enErreur.length, fond: "var(--color-status-perdu)" },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: k.fond }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-navy-700">
                    {k.label}
                  </div>
                  <div className="tabular font-display text-2xl font-bold text-navy-800">
                    {k.valeur}
                  </div>
                </div>
              ))}
            </div>

            {rapport.entetesInconnues.length > 0 ? (
              <div className="rounded-lg border border-navy-200 p-4">
                <div className="text-sm font-semibold text-navy-800">
                  Colonnes non reconnues — à rattacher
                </div>
                <p className="mt-0.5 mb-3 text-xs text-grey-brand">
                  Pour chaque colonne de ton fichier qui ne correspond à aucune
                  colonne du CRM, choisis à quelle colonne l&apos;associer (ou
                  laisse « Ignorer »), puis ré-analyse.
                </p>
                <div className="space-y-2">
                  {rapport.entetesInconnues.map((entete) => (
                    <div key={entete} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-40 font-medium text-navy-800">{entete}</span>
                      <span className="text-grey-brand">→</span>
                      <select
                        value={mapping[entete] ?? "ignore"}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [entete]: e.target.value }))
                        }
                        className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm focus:border-star-500 focus:outline-none"
                      >
                        <option value="ignore">— Ignorer —</option>
                        <optgroup label="Colonnes du CRM">
                          {COLONNES_IMPORT.map((c) => (
                            <option key={c.champ} value={c.champ}>
                              {c.entete}
                            </option>
                          ))}
                        </optgroup>
                        {champsPerso.length > 0 ? (
                          <optgroup label="Champs personnalisés">
                            {champsPerso.map((cp) => (
                              <option key={cp.cle} value={`perso:${cp.cle}`}>
                                {cp.libelle}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => formAnalyse.current?.requestSubmit()}
                  disabled={analyseEnCours}
                  className="mt-3 inline-flex h-9 items-center rounded-lg bg-navy-800 px-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
                >
                  {analyseEnCours ? "Analyse…" : "Ré-analyser avec ce rattachement"}
                </button>
              </div>
            ) : null}
            {rapport.entetesManquantes.length > 0 ? (
              <p className="text-sm text-grey-brand">
                Colonnes du modèle absentes du fichier :{" "}
                {rapport.entetesManquantes.join(", ")}. Ce n&apos;est pas bloquant.
              </p>
            ) : null}

            {avecDoublon.length > 0 ? (
              <div className="rounded-lg border border-navy-200">
                <div className="border-b border-navy-100 px-4 py-2.5 text-sm font-semibold text-navy-800">
                  Doublons — à toi de décider
                </div>
                <ul className="scroll-slim max-h-64 divide-y divide-navy-100 overflow-y-auto">
                  {avecDoublon.slice(0, 200).map((l) => (
                    <li key={l.numero} className="px-4 py-2 text-sm">
                      <span className="font-medium text-navy-800">
                        Ligne {l.numero} · {l.apercu}
                      </span>
                      <ul className="mt-0.5 text-xs text-grey-brand">
                        {l.doublons.map((d, i) => (
                          <li key={i}>— {phraseDoublon(d)}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 border-t border-navy-100 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={garderDoublons}
                    onChange={(e) => setGarderDoublons(e.currentTarget.checked)}
                    className="h-4 w-4 accent-[var(--color-star-500)]"
                  />
                  Importer quand même les doublons (ils viendront s&apos;ajouter,
                  sans écraser l&apos;existant)
                </label>
              </div>
            ) : null}

            {enErreur.length > 0 ? (
              <details className="rounded-lg border border-navy-200 px-4 py-2.5 text-sm">
                <summary className="cursor-pointer font-semibold text-navy-800">
                  {enErreur.length} ligne(s) écartée(s) pour erreur
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-grey-brand">
                  {enErreur.slice(0, 100).map((l) => (
                    <li key={l.numero}>
                      Ligne {l.numero} · {l.apercu} — {l.erreur}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {/* --- Validation --- */}
            <form action={actionEcriture} className="space-y-4 border-t border-navy-100 pt-4">
              <input
                type="hidden"
                name="lignes"
                value={JSON.stringify(retenues.map((l) => l.donnees))}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Source de ces leads"
                  hint="Obligatoire : c'est ce qui permet de savoir plus tard qui payer."
                >
                  <select name="source_id" required defaultValue="" className={classeSelect}>
                    <option value="" disabled>
                      — Choisis une source —
                    </option>
                    {sources.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Attribuer tout de suite à"
                  hint="Laisse vide pour les garder dans ton réservoir."
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
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={ecritureEnCours || retenues.length === 0}>
                  {ecritureEnCours
                    ? "Import en cours…"
                    : `Importer ${retenues.length} prospect(s)`}
                </Button>
                {ecriture ? (
                  <span
                    className={cn("rounded-lg px-3 py-1.5 text-sm text-navy-800")}
                    style={{
                      backgroundColor: ecriture.ok
                        ? "var(--color-status-signe)"
                        : "var(--color-status-perdu)",
                    }}
                  >
                    {ecriture.message}
                  </span>
                ) : null}
              </div>
            </form>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
