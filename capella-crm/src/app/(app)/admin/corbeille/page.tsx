import { requireManage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui";
import { nomComplet } from "@/lib/domain/noms";
import { fmtDateHeure } from "@/lib/format";
import { ListeCorbeille } from "./liste-corbeille";
import type { Affaire, Prospect } from "@/lib/domain/database.types";

export const metadata = { title: "Corbeille — Capella CRM" };
export const dynamic = "force-dynamic";

export default async function CorbeillePage() {
  await requireManage();
  const supabase = await createClient();

  // can_manage() donne accès aux lignes supprimées (politique « manage_all »).
  const [{ data: prospects }, { data: affaires }] = await Promise.all([
    supabase
      .from("prospects")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("affaires")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  const lesProspects = (prospects ?? []) as Prospect[];
  const lesAffaires = (affaires ?? []) as Affaire[];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-navy-800">Corbeille</h1>
        <p className="mt-1 text-sm text-grey-brand">
          Les éléments supprimés arrivent ici. Tu peux les restaurer, ou les
          supprimer pour de bon. Rien n&apos;est perdu tant que tu ne l&apos;as
          pas décidé.
        </p>
      </header>

      <Card className="mb-6">
        <CardHeader
          title="Prospects supprimés"
          hint={`${lesProspects.length} élément${lesProspects.length > 1 ? "s" : ""}`}
        />
        {lesProspects.length === 0 ? (
          <p className="px-5 py-6 text-sm text-grey-brand">La corbeille est vide.</p>
        ) : (
          <ListeCorbeille
            cible="prospect"
            items={lesProspects.map((p) => ({
              id: p.id,
              titre: p.raison_sociale || nomComplet(p.nom, p.prenom),
              sousTitre: `${p.ref} · supprimé le ${fmtDateHeure(p.deleted_at)}`,
            }))}
          />
        )}
      </Card>

      <Card>
        <CardHeader
          title="Affaires supprimées"
          hint={`${lesAffaires.length} élément${lesAffaires.length > 1 ? "s" : ""}`}
        />
        {lesAffaires.length === 0 ? (
          <p className="px-5 py-6 text-sm text-grey-brand">La corbeille est vide.</p>
        ) : (
          <ListeCorbeille
            cible="affaire"
            items={lesAffaires.map((a) => ({
              id: a.id,
              titre: a.raison_sociale,
              sousTitre: `${a.ref} · supprimée le ${fmtDateHeure(a.deleted_at)}`,
            }))}
          />
        )}
      </Card>
    </main>
  );
}
