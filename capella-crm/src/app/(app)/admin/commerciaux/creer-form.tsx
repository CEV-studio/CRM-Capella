"use client";

import { useActionState, useState } from "react";
import { creerCommercial } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { Button, Field, Input } from "@/components/ui";

/**
 * Création d'un compte commercial.
 * Le mot de passe provisoire s'affiche une seule fois, à l'écran :
 * il n'est envoyé par aucun email. Jeremy le transmet lui-même.
 */
export function CreerCommercialForm() {
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    creerCommercial,
    null,
  );
  const [copie, setCopie] = useState(false);

  async function copier(texte: string) {
    await navigator.clipboard.writeText(texte);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  return (
    <div className="px-5 py-4">
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
        <Field label="Nom et prénom">
          <Input name="full_name" required placeholder="Aly Badara Doumbouya" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required placeholder="aly@capellaenergy.fr" />
        </Field>
        <Field label="Commission %">
          <Input
            name="commission_rate"
            type="number"
            min={0}
            max={100}
            step="1"
            defaultValue={50}
            required
          />
        </Field>
        <Button type="submit" disabled={enCours} className="h-10">
          {enCours ? "Création…" : "Créer le compte"}
        </Button>
      </form>

      {etat && !etat.ok ? (
        <p
          role="alert"
          className="mt-4 rounded-lg px-3 py-2 text-sm text-navy-800"
          style={{ backgroundColor: "var(--color-status-perdu)" }}
        >
          {etat.message}
        </p>
      ) : null}

      {etat?.ok && etat.motDePasse ? (
        <div
          className="mt-4 rounded-lg border border-navy-200 p-4"
          style={{ backgroundColor: "var(--color-status-signe)" }}
        >
          <p className="text-sm font-semibold text-navy-800">{etat.message}</p>
          <p className="mt-1 text-sm text-navy-700">
            Transmets-lui ce mot de passe provisoire par WhatsApp ou SMS. Il devra
            en choisir un nouveau dès sa première connexion.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="tabular rounded-md bg-white px-3 py-2 font-mono text-base font-bold tracking-wide text-navy-800">
              {etat.motDePasse}
            </code>
            <Button
              type="button"
              variant="ghost"
              onClick={() => copier(etat.motDePasse!)}
            >
              {copie ? "Copié ✓" : "Copier"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-navy-700">
            ⚠️ Ce mot de passe ne sera plus jamais affiché. Si tu le perds, utilise
            « Réinitialiser » dans la liste ci-dessous.
          </p>
        </div>
      ) : null}
    </div>
  );
}
