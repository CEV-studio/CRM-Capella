import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AffaireForm } from "../affaire-form";
import { TransferProspectForm } from "@/components/transfer-prospect-form";
import { chargerApporteurs } from "@/lib/referentiels";
import type { Profile, Prospect } from "@/lib/domain/database.types";

export const metadata = { title: "Nouvelle demande de cotation — Capella CRM" };
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

  const p = source as Prospect | null;

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
          Nouvelle demande de cotation
        </h1>
        
      </header>

      {p ? <TransferProspectForm prospectId={p.id} /> : <AffaireForm
        estAdmin={estAdmin}
        apporteurs={apporteurs
          .filter((x) => x.is_active)
          .map((x) => ({ value: x.id, label: x.name }))}
        commerciaux={(profils ?? []).map((c) => ({
          value: c.id,
          label: c.full_name,
        }))}
      />}
    </main>
  );
}
