import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = new Set([
  "prenom", "nom", "mail", "tel_mobile", "tel_fixe",
  "fournisseur_electricite", "fournisseur_gaz", "pdl", "pce",
  "car_electricite", "car_gaz", "option_tarifaire", "date_fin_contrat",
  "raison_sociale", "siren", "naf", "code_postal", "segment", "nb_sites",
  "next_action", "next_action_date", "score",
]);

const NUMBER_FIELDS = new Set(["car_electricite", "car_gaz", "nb_sites", "score"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const payload = await request.json().catch(() => ({})) as { field?: string; value?: unknown };
  const field = String(payload.field ?? "");
  if (!ALLOWED.has(field)) return NextResponse.json({ error: "Champ non modifiable ici." }, { status: 400 });

  let value: string | number | null = payload.value == null ? null : String(payload.value).trim();
  if (value === "") value = null;
  if (NUMBER_FIELDS.has(field) && value !== null) {
    const parsed = Number(String(value).replace(",", "."));
    if (!Number.isFinite(parsed)) return NextResponse.json({ error: "Valeur numérique invalide." }, { status: 400 });
    value = parsed;
  }

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("prospects")
    .update({ [field]: value, last_action_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, value });
}
