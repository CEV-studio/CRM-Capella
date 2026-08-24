import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AffaireForm } from "../affaire-form";
import { chargerApporteurs } from "@/lib/referentiels";
import type { Affaire, Profile, Prospect } from "@/lib/domain/database.types";

export const metadata = { title: "Nouvelle affaire — Capella CRM" };
export const dynamic = "force-dynamic";

export default async function NouvelleAffairePage({
  searchParams,
}: {
  searchParams: Promise<{ prospect?: string }>;
}) {
  const profil = await requireProfile();
  const estAdmin = profil.role === "admin";
  const { prospect: prospectId } = await searchParams;

  const supabase = await createClient();

  const [apporteurs, { data: profils }, { data: source }] =
    await Promise.all([
      chargerApporteurs(),
      estAdmin
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .eq("is_active", true)
            .order("full_name")
        : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name">[] }),
      prospectId
        ? supabase.from("prospects").select("*").eq("id", prospectId).is("deleted_at", null).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // Bascule depuis un prospect : on recopie ce qu'on sait déjà,
  // le commercial n'a plus qu'à compléter le contrat.
  const p = source as Prospect | null;
  const prefill = p
    ? ({
        prospect_id: p.id,
        source_id: p.source_id,
        raison_sociale:
          p.raison_sociale ?? [p.prenom, p.nom].filter(Boolean).join(" ") ?? "",
        siren: p.siren,
        nom: p.nom,
        prenom: p.prenom,
        mail: p.mail,
        telephone: p.tel_mobile ?? p.tel_fixe,
        pdl_elec: p.pdl,
        pce_gaz: p.pce,
        fournisseur: p.fournisseur_electricite,
        date_echeance: p.date_fin_contrat,
        notes: p.notes,
        stage: "Demande de cotation",
      } as Partial<Affaire> & { prospect_id: string; source_id: string | null })
    : undefined;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <Link
        href={p ? `/prospection/${p.id}` : "/conversion"}
        className="text-sm text-grey-brand underline underline-offset-2 hover:text-navy-700"
      >
        ← {p ? "Retour à la fiche prospect" : "Retour au pipeline"}
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="font-display text-2xl font-bold text-navy-800">
          Nouvelle affaire
        </h1>
        <p className="mt-1 text-sm text-grey-brand">
          {p
            ? `Pré-remplie depuis le prospect ${p.ref}. Le prospect est conservé : le lien entre les deux reste tracé.`
            : "Saisie directe, avec les mêmes champs que l'ancien formulaire Google."}
        </p>
      </header>

      <AffaireForm
        prefill={prefill}
        estAdmin={estAdmin}
        apporteurs={apporteurs
          .filter((x) => x.is_active)
          .map((x) => ({ value: x.id, label: x.name }))}
        commerciaux={(profils ?? []).map((c) => ({
          value: c.id,
          label: c.full_name,
        }))}
      />
    </main>
  );
}
