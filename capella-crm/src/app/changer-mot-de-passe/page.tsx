import { redirect } from "next/navigation";
import { Logotype } from "@/components/brand";
import { requireProfile } from "@/lib/auth";
import { ChangerForm } from "./changer-form";

export const metadata = { title: "Nouveau mot de passe — Capella CRM" };
export const dynamic = "force-dynamic";

export default async function ChangerMotDePassePage() {
  const profile = await requireProfile();

  // Personne n'a besoin de cet écran s'il a déjà choisi son mot de passe.
  if (!profile.must_change_password) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-800 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center text-white">
          <Logotype />
        </div>

        <div className="rounded-[var(--radius-card)] bg-white p-6 shadow-xl">
          <h1 className="font-display text-xl font-bold text-navy-800">
            Choisis ton mot de passe
          </h1>
          <p className="mt-1 mb-5 text-sm text-grey-brand">
            Bonjour {profile.full_name.split(" ")[0]}. Le mot de passe qu&apos;on
            t&apos;a transmis était provisoire : choisis-en un qui n&apos;appartient
            qu&apos;à toi.
          </p>

          <ChangerForm />
        </div>
      </div>
    </main>
  );
}
