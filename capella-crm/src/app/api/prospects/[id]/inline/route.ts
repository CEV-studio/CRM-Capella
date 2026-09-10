import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = new Set([
  "prenom", "nom", "mail", "tel_mobile", "tel_fixe",
  "fournisseur_electricite", "fournisseur_gaz", "pdl", "pce", "puissance",
  "car_electricite", "car_gaz", "option_tarifaire", "date_fin_contrat",
  "sans_engagement",
  "raison_sociale", "siren", "naf", "code_postal", "segment", "nb_sites",
  "next_action", "next_action_date", "score", "score_ellipro", "score_ellipro",
]);

const NUMBER_FIELDS = new Set(["car_electricite", "car_gaz", "nb_sites", "score", "score_ellipro"]);
const BOOLEAN_FIELDS = new Set(["sans_engagement"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const payload = await request.json().catch(() => ({})) as { field?: string; value?: unknown };
  const field = String(payload.field ?? "");
  if (!ALLOWED.has(field)) return NextResponse.json({ error: "Champ non modifiable ici." }, { status: 400 });

  let value: string | number | boolean | null = payload.value == null ? null : String(payload.value).trim();
  if (value === "") value = null;
  if (BOOLEAN_FIELDS.has(field)) value = payload.value === true;
  if (NUMBER_FIELDS.has(field) && value !== null) {
    const parsed = Number(String(value).replace(",", "."));
    if (!Number.isFinite(parsed)) return NextResponse.json({ error: "Valeur numérique invalide." }, { status: 400 });
    value = parsed;
  }

  const supabase = await createClient();
  const patch: Record<string, string | number | boolean | null> = { [field]: value, last_action_at: new Date().toISOString() };
  if (field === "sans_engagement" && value === true) patch.date_fin_contrat = null;
  const { error } = await (supabase as any)
    .from("prospects")
    .update(patch)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, value });
}
