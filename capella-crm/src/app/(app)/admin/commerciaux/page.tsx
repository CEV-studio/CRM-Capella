import { requireManage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui";
import { CreerCommercialForm } from "./creer-form";
import { LigneCommercial } from "./ligne-commercial";
import type { Profile } from "@/lib/domain/database.types";

export const metadata = { title: "Commerciaux — Capella CRM" };
export const dynamic = "force-dynamic";

export default async function CommerciauxPage() {
  const moi = await requireManage();

  // Lecture avec la session admin : la politique RLS lui donne accès à tous
  // les profils, sans avoir besoin de la clé de service.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("is_active", { ascending: false })
    .order("full_name");

  const profils = (data ?? []) as Profile[];
  const actifs = profils.filter((p) => p.is_active);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-navy-800">
          Commerciaux
        </h1>
        <p className="mt-1 text-sm text-grey-brand">
          {actifs.length} compte{actifs.length > 1 ? "s" : ""} actif
          {actifs.length > 1 ? "s" : ""} sur {profils.length}.
        </p>
      </header>

      <Card className="mb-6">
        <CardHeader
          title="Créer un compte"
          hint="Le mot de passe provisoire s'affiche à l'écran. Aucun email n'est envoyé : tu le transmets toi-même."
        />
        <CreerCommercialForm />
      </Card>

      <Card>
        <CardHeader
          title="Équipe"
          hint="Un commercial désactivé perd immédiatement l'accès à toutes les données."
        />
        {error ? (
          <p className="px-5 py-4 text-sm text-navy-800">
            Lecture impossible : {error.message}
          </p>
        ) : profils.length === 0 ? (
          <p className="px-5 py-4 text-sm text-grey-brand">
            Aucun compte pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {profils.map((p) => (
              <LigneCommercial key={p.id} profil={p} estMoi={p.id === moi.id} />
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-xs text-grey-brand">
        À prévoir : quand tu désactiveras un commercial qui a déjà des prospects
        et des affaires, l&apos;écran te proposera de les réattribuer en un clic.
        Cette partie arrive à l&apos;étape 4.
      </p>
    </main>
  );
}
