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

function apiKey() {
  const key = process.env.YOUTRUST_API_KEY;
  if (!key) throw new Error("YOUTRUST_API_KEY manquante");
  return key;
}

async function lireReponse<T>(res: Response): Promise<T> {
  const body = await res.text();
  let json: any = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    json = body;
  }
  if (!res.ok) {
    throw new Error(json?.detail ?? json?.message ?? String(json || `Youtrust HTTP ${res.status}`));
  }
  return json as T;
}

async function youtrustJson<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  return lireReponse<T>(res);
}

async function youtrustForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
    cache: "no-store",
  });
  return lireReponse<T>(res);
}

function generateurUrl() {
  if (process.env.ACD_GENERATOR_URL) return process.env.ACD_GENERATOR_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/generate-acd`;
  return "http://127.0.0.1:3000/api/generate-acd";
}

async function genererPdfAcd(data: Record<string, string>): Promise<ArrayBuffer> {
  const secret = process.env.FORM_WEBHOOK_SECRET;
  if (!secret) throw new Error("FORM_WEBHOOK_SECRET manquant : génération ACD sécurisée impossible");

  const res = await fetch(generateurUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-capella-internal-secret": secret,
    },
    body: JSON.stringify(data),
    cache: "no-store",
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Génération ACD impossible (${res.status}) : ${message.slice(0, 500)}`);
  }
  return res.arrayBuffer();
}

export async function envoyerAcdYoutrustSiNecessaire(prospectId: string): Promise<ResultatAcd> {
  if (!process.env.YOUTRUST_API_KEY) {
    return { ok: true, skipped: true, message: "Youtrust non configuré." };
  }

  const admin = createAdminClient();
  // Les colonnes Youtrust viennent de la migration 0008 et seront intégrées
  // aux types générés Supabase lors de la prochaine régénération automatique.
  const prospects = admin.from("prospects") as any;
  const { data: prospect, error } = await prospects
    .select(
      "id, ref, stage, raison_sociale, siren, nom, prenom, mail, tel_mobile, tel_fixe, pdl, pce, code_postal, acd_youtrust_request_id, acd_sent_at",
    )
    .eq("id", prospectId)
    .single();

  if (error || !prospect) return { ok: false, message: error?.message ?? "Prospect introuvable." };
  if (prospect.stage !== ETAPE_ACD) return { ok: true, skipped: true, message: "Étape ACD non atteinte." };
  if (prospect.acd_youtrust_request_id || prospect.acd_sent_at) {
    return { ok: true, skipped: true, message: "ACD déjà envoyée." };
  }

  const email = String(prospect.mail ?? "").trim();
  const telephone = String(prospect.tel_mobile ?? prospect.tel_fixe ?? "").trim();
  const societe = String(prospect.raison_sociale ?? "").trim();
  const numeroSociete = String(prospect.siren ?? "").trim();
  const firstName = String(prospect.prenom ?? "Client").trim();
  const lastName = String(prospect.nom ?? societe ?? "Capella").trim();

  const manquants = [
    !societe && "raison sociale",
    !numeroSociete && "SIREN/SIRET",
    !email && "email décisionnaire",
    !telephone && "téléphone",
  ].filter(Boolean);
  if (manquants.length) {
    return { ok: false, message: `ACD non envoyée : champ(s) manquant(s) : ${manquants.join(", ")}.` };
  }

  try {
    const today = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());

    const pdf = await genererPdfAcd({
      nom_prenom: [firstName, lastName].filter(Boolean).join(" "),
      nom_societe: societe,
      siret: numeroSociete,
      mail: email,
      telephone,
      pdl: String(prospect.pdl ?? ""),
      pce: String(prospect.pce ?? ""),
      fait_a: "",
      date_signature: today,
    });

    // 1. Brouillon Youtrust.
    const sr = await youtrustJson<{ id: string }>("/signature_requests", {
      method: "POST",
      body: JSON.stringify({
        name: `ACD - ${societe || prospect.ref || prospect.id}`.slice(0, 128),
        delivery_mode: "email",
        timezone: "Europe/Paris",
        external_id: prospect.ref || prospect.id,
      }),
    });

    // 2. Upload du PDF généré dynamiquement.
    const form = new FormData();
    form.append("file", new Blob([pdf], { type: "application/pdf" }), `ACD_${societe.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
    form.append("nature", "signable_document");
    const document = await youtrustForm<{ id: string }>(`/signature_requests/${sr.id}/documents`, form);

    // 3. Signataire + champ de signature sur la zone "Signature" du PDF A4.
    await youtrustJson(`/signature_requests/${sr.id}/signers`, {
      method: "POST",
      body: JSON.stringify({
        info: {
          first_name: firstName,
          last_name: lastName,
          email,
          locale: "fr",
        },
        signature_level: "electronic_signature",
        signature_authentication_mode: "no_otp",
        fields: [
          {
            type: "signature",
            document_id: document.id,
            page: 1,
            x: 75,
            y: 655,
            width: 180,
            height: 55,
          },
        ],
      }),
    });

    // 4. Activation = envoi email par Youtrust.
    await youtrustJson(`/signature_requests/${sr.id}/activate`, { method: "POST" });

    await prospects
      .update({
        acd_youtrust_request_id: sr.id,
        acd_sent_at: new Date().toISOString(),
        acd_status: "envoyee",
        acd_error: null,
      })
      .eq("id", prospect.id);

    return { ok: true, message: "ACD générée et envoyée via Youtrust." };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prospects
      .update({ acd_status: "erreur", acd_error: message.slice(0, 1000) })
      .eq("id", prospect.id);
    return { ok: false, message: `Étape enregistrée, mais ACD non envoyée : ${message}` };
  }
}
