import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const ETAPE_ACD = "Demande ACD";

type ResultatAcd =
  | { ok: true; skipped?: boolean; message: string }
  | { ok: false; message: string };

function baseUrl() {
  return process.env.YOUTRUST_ENV === "sandbox"
    ? "https://api-sandbox.yousign.app/v3"
    : "https://api.yousign.app/v3";
}

async function youtrust<T>(path: string, init: RequestInit): Promise<T> {
  const key = process.env.YOUTRUST_API_KEY;
  if (!key) throw new Error("YOUTRUST_API_KEY manquante");

  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await res.text();
  const json = body ? JSON.parse(body) : null;
  if (!res.ok) {
    throw new Error(json?.detail ?? json?.message ?? `Youtrust HTTP ${res.status}`);
  }
  return json as T;
}

export async function envoyerAcdYoutrustSiNecessaire(prospectId: string): Promise<ResultatAcd> {
  const apiKey = process.env.YOUTRUST_API_KEY;
  const templateId = process.env.YOUTRUST_TEMPLATE_ID;
  if (!apiKey || !templateId) {
    return { ok: true, skipped: true, message: "Youtrust non configuré." };
  }

  const admin = createAdminClient();
  const { data: prospect, error } = await admin
    .from("prospects")
    .select(
      "id, ref, stage, raison_sociale, nom, prenom, mail, tel_mobile, acd_youtrust_request_id, acd_sent_at",
    )
    .eq("id", prospectId)
    .single();

  if (error || !prospect) return { ok: false, message: error?.message ?? "Prospect introuvable." };
  if (prospect.stage !== ETAPE_ACD) return { ok: true, skipped: true, message: "Étape ACD non atteinte." };
  if (prospect.acd_youtrust_request_id || prospect.acd_sent_at) {
    return { ok: true, skipped: true, message: "ACD déjà envoyée." };
  }
  if (!prospect.mail) return { ok: false, message: "Email décisionnaire manquant : ACD non envoyée." };

  const firstName = (prospect.prenom || "Client").trim();
  const lastName = (prospect.nom || prospect.raison_sociale || "Capella").trim();

  try {
    const sr = await youtrust<{ id: string }>("/signature_requests", {
      method: "POST",
      body: JSON.stringify({
        name: `ACD - ${prospect.raison_sociale || prospect.ref || prospect.id}`.slice(0, 128),
        delivery_mode: "email",
        timezone: "Europe/Paris",
        template_id: templateId,
        external_id: prospect.ref || prospect.id,
      }),
    });

    await youtrust(`/signature_requests/${sr.id}/signers`, {
      method: "POST",
      body: JSON.stringify({
        info: {
          first_name: firstName,
          last_name: lastName,
          email: prospect.mail,
          locale: "fr",
        },
        signature_level: "electronic_signature",
        signature_authentication_mode: "no_otp",
      }),
    });

    await youtrust(`/signature_requests/${sr.id}/activate`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    await admin
      .from("prospects")
      .update({
        acd_youtrust_request_id: sr.id,
        acd_sent_at: new Date().toISOString(),
        acd_status: "envoyee",
        acd_error: null,
      })
      .eq("id", prospect.id);

    return { ok: true, message: "ACD envoyée via Youtrust." };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("prospects")
      .update({ acd_status: "erreur", acd_error: message.slice(0, 1000) })
      .eq("id", prospect.id);
    return { ok: false, message: `Étape enregistrée, mais ACD non envoyée : ${message}` };
  }
}
