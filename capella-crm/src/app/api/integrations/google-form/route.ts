import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AffaireInsert, TypeEnergie } from "@/lib/domain/database.types";

function txt(v: unknown) {
  return String(v ?? "").trim();
}

function isoDateFr(v: unknown) {
  const s = txt(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function isoDateTimeFr(v: unknown) {
  const s = txt(v);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return new Date().toISOString();
  const year = Number(m[3]);
  const month = Number(m[2]) - 1;
  const day = Number(m[1]);
  const hour = Number(m[4] ?? 0);
  const minute = Number(m[5] ?? 0);
  const second = Number(m[6] ?? 0);
  return new Date(Date.UTC(year, month, day, hour - 2, minute, second)).toISOString();
}

export async function POST(req: NextRequest) {
  const secret = process.env.FORM_WEBHOOK_SECRET;
  const given = req.headers.get("x-capella-form-secret");
  if (!secret || !given || given !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const payload = await req.json();
  const externalId = txt(payload.external_id);
  if (!externalId) {
    return NextResponse.json({ ok: false, error: "external_id manquant" }, { status: 400 });
  }

  const admin = createAdminClient();
  const source = "google_form_nouveau_client";

  const { data: existing } = await admin
    .from("form_submissions")
    .select("id, affaire_id, processed_at")
    .eq("source", source)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing?.processed_at) {
    return NextResponse.json({ ok: true, duplicate: true, affaire_id: existing.affaire_id });
  }

  const { data: submission, error: subError } = await admin
    .from("form_submissions")
    .upsert(
      { source, external_id: externalId, submitted_at: isoDateTimeFr(payload.horodateur), payload },
      { onConflict: "source,external_id" },
    )
    .select("id")
    .single();

  if (subError || !submission) {
    return NextResponse.json({ ok: false, error: subError?.message ?? "submission" }, { status: 500 });
  }

  try {
    const vendeur = txt(payload.vendeur);
    const vendeurNorm = vendeur.toLowerCase();
    const aliases: Record<string, string> = {
      "jeremy": "jeremy",
      "thibault": "thibault",
      "januario jimmy": "jimmy januario",
      "jimmy": "jimmy januario",
    };
    const cible = aliases[vendeurNorm] ?? vendeurNorm;
    const { data: profils } = await admin.from("profiles").select("id, full_name").eq("is_active", true);
    const commercial = (profils ?? []).find((p) => p.full_name.trim().toLowerCase() === cible);
    if (!commercial) throw new Error(`Commercial introuvable : ${vendeur}`);

    const energie = txt(payload.energie);
    const compteur = txt(payload.numero_compteur);
    const typeEnergie: TypeEnergie =
      energie === "Gaz" ? "Gaz" : energie === "Électricité" ? "Électricité" : "Élec+Gaz";

    const affaire: AffaireInsert = {
      commercial_id: commercial.id,
      raison_sociale: txt(payload.nom_entreprise) || "Sans raison sociale",
      adresse_conso: txt(payload.adresse_consommation) || null,
      siren: txt(payload.siret) || null,
      nom: txt(payload.nom_dirigeant) || null,
      prenom: txt(payload.prenom_dirigeant) || null,
      mail: txt(payload.mail_decisionnaire) || null,
      telephone: txt(payload.telephone_decisionnaire) || null,
      type_energie: typeEnergie,
      pdl_elec: energie === "Électricité" ? compteur || null : null,
      pce_gaz: energie === "Gaz" ? compteur || null : null,
      date_echeance: isoDateFr(payload.echeance_contrat),
      date_relance: isoDateFr(payload.date_r2),
      facture: txt(payload.facture_client) || null,
      acd: txt(payload.accord_collecte) || null,
      notes: txt(payload.commentaires) || null,
      stage: "Demande de cotation",
      legacy_payload: { google_form: payload },
    };

    const { data: created, error } = await admin.from("affaires").insert(affaire).select("id, ref").single();
    if (error || !created) throw new Error(error?.message ?? "Création affaire impossible");

    await admin
      .from("form_submissions")
      .update({ affaire_id: created.id, processed_at: new Date().toISOString(), error: null })
      .eq("id", submission.id);

    return NextResponse.json({ ok: true, affaire_id: created.id, ref: created.ref });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("form_submissions").update({ error: message }).eq("id", submission.id);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
