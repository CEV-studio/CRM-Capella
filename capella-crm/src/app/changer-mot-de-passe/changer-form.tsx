"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { changerMonMotDePasse } from "./actions";
import type { ActionResult } from "@/lib/action-result";
import { Button, Field, Input } from "@/components/ui";

export function ChangerForm() {
  const router = useRouter();
  const [etat, action, enCours] = useActionState<ActionResult | null, FormData>(
    changerMonMotDePasse,
    null,
  );

  useEffect(() => {
    if (etat?.ok) {
      router.replace("/");
      router.refresh();
    }
  }, [etat, router]);

  return (
    <form action={action} className="space-y-4">
      <Field label="Nouveau mot de passe" hint="10 caractères minimum.">
        <Input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </Field>

      <Field label="Répète-le">
        <Input
          type="password"
          name="confirmation"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </Field>

      {etat && !etat.ok ? (
        <p
          role="alert"
          className="rounded-lg px-3 py-2 text-sm text-navy-800"
          style={{ backgroundColor: "var(--color-status-perdu)" }}
        >
          {etat.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer et entrer"}
      </Button>
    </form>
  );
}
