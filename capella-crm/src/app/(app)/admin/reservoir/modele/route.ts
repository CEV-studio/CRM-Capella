import { requireAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { ENTETES_IMPORT, EXEMPLE_IMPORT } from "@/lib/domain/import-template";

/**
 * Modèle d'import à télécharger.
 * Il contient une ligne d'exemple, que Jeremy remplace par ses données.
 */
export async function GET() {
  await requireAdmin();

  const csv = toCsv(ENTETES_IMPORT, [EXEMPLE_IMPORT]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="modele-import-prospects-capella.csv"',
    },
  });
}
