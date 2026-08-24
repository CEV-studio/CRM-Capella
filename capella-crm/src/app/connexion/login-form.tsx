"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input } from "@/components/ui";

/**
 * Formulaire de connexion.
 * Le changement de mot de passe obligatoire à la première connexion
 * sera branché à l'étape 2, une fois les comptes commerciaux créés.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const suite = params.get("suite") ?? "/";
  const motif = params.get("motif");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(
    motif === "compte-desactive"
      ? "Ton compte a été désactivé. Contacte Jeremy."
      : null,
  );
  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErreur(
        error.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : error.message,
      );
      setEnCours(false);
      return;
    }

    router.replace(suite);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email">
        <Input
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom@capellaenergy.fr"
        />
      </Field>

      <Field label="Mot de passe">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {erreur ? (
        <p
          role="alert"
          className="rounded-lg px-3 py-2 text-sm text-navy-800"
          style={{ backgroundColor: "var(--color-status-perdu)" }}
        >
          {erreur}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={enCours}>
        {enCours ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
