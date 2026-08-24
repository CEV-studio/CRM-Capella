import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

/**
 * Tout ce qui vit sous ce layout exige une session valide.
 * Un compte qui n'a pas encore changé son mot de passe provisoire
 * ne peut aller nulle part ailleurs que sur l'écran de changement.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  if (profile.must_change_password) {
    redirect("/changer-mot-de-passe");
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
