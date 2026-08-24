import { Suspense } from "react";
import { Logotype } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion — Capella CRM" };

export default function ConnexionPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-800 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center text-white">
          <Logotype />
        </div>

        <div className="rounded-[var(--radius-card)] bg-white p-6 shadow-xl">
          <h1 className="font-display text-xl font-bold text-navy-800">
            Connexion
          </h1>
          <p className="mt-1 mb-5 text-sm text-grey-brand">
            Accès réservé à l&apos;équipe Capella Energy.
          </p>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-navy-300">
          Mot de passe oublié ? Demande à Jeremy de t&apos;en générer un nouveau.
        </p>
      </div>
    </main>
  );
}
