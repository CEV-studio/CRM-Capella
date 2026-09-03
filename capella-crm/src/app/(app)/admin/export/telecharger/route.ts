import { requireExport } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { creerZip, type FichierZip } from "@/lib/zip";

/**
 * Export complet — sert de sauvegarde tant que le projet est sur le plan
 * gratuit Supabase. Un seul téléchargement, un CSV par table à l'intérieur.
 */

export const dynamic = "force-dynamic";

type TableExportable =
  | "prospects"
  | "affaires"
  | "profiles"
  | "apporteurs"
  | "sources";

/** Tables exportées, avec les colonnes et leurs intitulés lisibles. */
const TABLES: {
  table: TableExportable;
  fichier: string;
  colonnes: [string, string][];
  tri: string;
}[] = [
  {
    table: "prospects",
    fichier: "prospects.csv",
    tri: "created_at",
    colonnes: [
      ["ref", "ID"], ["raison_sociale", "Raison Sociale"], ["nom", "Nom"], ["prenom", "Prénom"],
      ["mail", "Mail"], ["tel_mobile", "Tel Mobile"], ["tel_fixe", "Tel Fixe"],
      ["siren", "SIREN"], ["pdl", "PDL"], ["pce", "PCE"],
      ["puissance", "Puissance compteur"], ["car_electricite", "CAR Électricité"], ["car_gaz", "CAR Gaz"],
      ["option_tarifaire", "Option tarifaire"], ["code_postal", "Code postal"],
      ["naf", "NAF"], ["nb_sites", "Nb sites"], ["segment", "Segment"],
      ["score", "Score"],
      ["fournisseur_electricite", "Fournisseur Élec"],
      ["fournisseur_gaz", "Fournisseur Gaz"],
      ["date_fin_contrat", "Date fin contrat"], ["stage", "Étape"],
      ["next_action", "Prochaine action"], ["next_action_date", "Date prochaine action"],
      ["notes", "Notes"], ["last_action_at", "Dernière action"],
      ["_source", "Source"], ["_commercial", "Commercial assigné"],
      ["assigned_at", "Date attribution"], ["created_at", "Créé le"],
    ],
  },
  {
    table: "affaires",
    fichier: "affaires.csv",
    tri: "date_entree",
    colonnes: [
      ["ref", "ID"], ["_commercial", "Commercial"], ["_apporteur", "Apporteur"],
      ["raison_sociale", "Raison Sociale"], ["stage", "Étape"],
      ["adresse_conso", "Adresse conso"], ["siren", "SIREN"],
      ["nom", "Nom"], ["prenom", "Prénom"], ["mail", "Mail"], ["telephone", "Téléphone"],
      ["fournisseur", "Fournisseur"], ["type_energie", "Type"], ["contrat", "Contrat"],
      ["pdl_elec", "PDL Élec"], ["pce_gaz", "PCE Gaz"], ["date_debut", "Date Début"],
      ["date_echeance", "Date d'échéance"], ["car_mwh", "CAR (MWh)"],
      ["date_entree", "Date entrée"], ["date_signature", "Date signature"],
      ["date_relance", "Date relance"], ["commission", "Commission (€)"],
      ["notes", "Notes"],
      ["_source", "Source"], ["_prospect", "Issue du prospect"],
    ],
  },
  {
    table: "profiles",
    fichier: "commerciaux.csv",
    tri: "full_name",
    colonnes: [
      ["full_name", "Commercial"], ["email", "Email"], ["role", "Rôle"],
      ["commission_rate", "Taux commission"], ["is_active", "Actif"],
      ["can_export", "Peut exporter"], ["can_view_all", "Voit tous les leads"],
      ["can_manage_team", "Gère l'équipe"], ["created_at", "Créé le"],
    ],
  },
  {
    table: "apporteurs",
    fichier: "apporteurs.csv",
    tri: "name",
    colonnes: [
      ["name", "Apporteur"], ["contact", "Contact"],
      ["commission_rate", "Taux commission"], ["payment_status", "Statut paiement"],
      ["is_active", "Actif"],
    ],
  },
  {
    table: "sources",
    fichier: "sources.csv",
    tri: "name",
    colonnes: [["name", "Source"], ["kind", "Type"], ["is_active", "Active"]],
  },
];

function valeur(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "oui" : "non";
  return String(v);
}

export async function GET() {
  await requireExport();
  // Client de session (RLS) et NON clé de service : chacun n'exporte que ce
  // qu'il a le droit de voir. L'admin voit tout via ses politiques ;
  // un commercial « peut exporter » n'obtient que ses propres lignes.
  const admin = await createClient();

  // Dictionnaires pour remplacer les identifiants techniques par des noms.
  const [{ data: profils }, { data: apporteurs }, { data: sources }, { data: prospectsRef }] =
    await Promise.all([
      admin.from("profiles").select("id, full_name"),
      admin.from("apporteurs").select("id, name"),
      admin.from("sources").select("id, name"),
      admin.from("prospects").select("id, ref"),
    ]);

  const nomCommercial = new Map((profils ?? []).map((p) => [p.id, p.full_name]));
  const nomApporteur = new Map((apporteurs ?? []).map((a) => [a.id, a.name]));
  const nomSource = new Map((sources ?? []).map((s) => [s.id, s.name]));
  const refProspect = new Map((prospectsRef ?? []).map((p) => [p.id, p.ref]));

  const fichiers: FichierZip[] = [];

  for (const def of TABLES) {
    let requete = admin.from(def.table).select("*").order(def.tri, { ascending: true });
    // Prospects et affaires : la corbeille n'est pas exportée.
    if (def.table === "prospects" || def.table === "affaires") {
      requete = requete.is("deleted_at", null);
    }
    const { data, error } = await requete;

    if (error) {
      fichiers.push({
        nom: def.fichier,
        contenu: toCsv(["Erreur"], [[error.message]]),
      });
      continue;
    }

    const lignes = ((data ?? []) as Record<string, unknown>[]).map((l) =>
      def.colonnes.map(([champ]) => {
        switch (champ) {
          case "_commercial":
            return nomCommercial.get(String(l.assigned_to ?? l.commercial_id ?? "")) ?? "";
          case "_apporteur":
            return nomApporteur.get(String(l.apporteur_id ?? "")) ?? "";
          case "_source":
            return nomSource.get(String(l.source_id ?? "")) ?? "";
          case "_prospect":
            return refProspect.get(String(l.prospect_id ?? "")) ?? "";
          default:
            return valeur(l[champ]);
        }
      }),
    );

    fichiers.push({
      nom: def.fichier,
      contenu: toCsv(def.colonnes.map(([, entete]) => entete), lignes),
    });
  }

  // Journal d'attribution : la traçabilité « qui a eu ce lead, et quand ».
  const { data: journal } = await admin
    .from("lead_assignments")
    .select("*")
    .order("created_at");

  fichiers.push({
    nom: "journal-attributions.csv",
    contenu: toCsv(
      ["Date", "Prospect", "De", "Vers", "Par"],
      ((journal ?? []) as Record<string, unknown>[]).map((l) => [
        valeur(l.created_at),
        refProspect.get(String(l.prospect_id)) ?? "",
        nomCommercial.get(String(l.from_user ?? "")) ?? "Réservoir",
        nomCommercial.get(String(l.to_user ?? "")) ?? "Réservoir",
        nomCommercial.get(String(l.assigned_by ?? "")) ?? "",
      ]),
    ),
  });

  const jour = new Date().toISOString().slice(0, 10);
  const archive = creerZip(fichiers);

  return new Response(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="capella-crm-export-${jour}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
