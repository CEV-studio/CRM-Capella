import { requireExport } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui";
import { fmtNombre } from "@/lib/format";

export const metadata = { title: "Export complet — Capella CRM" };
export const dynamic = "force-dynamic";

export default async function ExportPage() {
  await requireExport();
  const supabase = await createClient();

  const [prospects, affaires, commerciaux, apporteurs, journal] = await Promise.all([
    supabase.from("prospects").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("affaires").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("apporteurs").select("id", { count: "exact", head: true }),
    supabase.from("lead_assignments").select("id", { count: "exact", head: true }),
  ]);

  const contenu = [
    { nom: "prospects.csv", quoi: "Tous tes prospects", nb: prospects.count },
    { nom: "affaires.csv", quoi: "Toutes tes affaires", nb: affaires.count },
    { nom: "commerciaux.csv", quoi: "Ton équipe et ses taux", nb: commerciaux.count },
    { nom: "apporteurs.csv", quoi: "Tes apporteurs d'affaires", nb: apporteurs.count },
    { nom: "sources.csv", quoi: "Tes canaux d'acquisition", nb: null },
    {
      nom: "journal-attributions.csv",
      quoi: "Qui a reçu quel lead, et quand",
      nb: journal.count,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-navy-800">
          Export complet
        </h1>
        <p className="mt-1 text-sm text-grey-brand">
          Toutes tes données, en un fichier. C&apos;est ta sauvegarde.
        </p>
      </header>

      <Card className="mb-6">
        <CardHeader
          title="Télécharger"
          hint="Un fichier ZIP contenant un tableau CSV par catégorie."
        />
        <div className="px-5 py-4">
          <a
            href="/admin/export/telecharger"
            className="inline-flex h-11 items-center rounded-lg bg-star-500 px-5 text-sm font-semibold text-white hover:bg-star-600"
          >
            ↓ Télécharger tout ({new Date().toLocaleDateString("fr-FR")})
          </a>

          <ul className="mt-5 divide-y divide-navy-100 border-t border-navy-100">
            {contenu.map((c) => (
              <li key={c.nom} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-medium text-navy-800">{c.nom}</div>
                  <div className="text-xs text-grey-brand">{c.quoi}</div>
                </div>
                {c.nb != null ? (
                  <span className="tabular text-sm text-navy-700">
                    {fmtNombre(c.nb)} ligne{c.nb > 1 ? "s" : ""}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pourquoi c'est important" />
        <div className="space-y-3 px-5 py-4 text-sm text-navy-700">
          <p>
            Le plan gratuit de Supabase ne garde pas d&apos;historique de
            sauvegarde. Si quelque chose tourne mal, ce fichier est ta seule
            copie. <strong>Télécharge-le une fois par semaine</strong> et garde-le
            ailleurs que sur ton Mac — Drive, disque externe, peu importe, mais
            ailleurs.
          </p>
          <p>
            Les fichiers s&apos;ouvrent directement dans Excel ou Google Sheets.
            Les identifiants techniques sont remplacés par les vrais noms :
            « Aly » plutôt qu&apos;une suite de caractères.
          </p>
          <p
            className="rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--color-status-relance)" }}
          >
            Quand le CRM portera vraiment le business, passe au{" "}
            <strong>plan Pro Supabase (~25 $/mois)</strong> : sauvegardes
            quotidiennes automatiques sur 7 jours. Cet export restera utile, mais
            il ne sera plus ton seul filet.
          </p>
        </div>
      </Card>
    </main>
  );
}
