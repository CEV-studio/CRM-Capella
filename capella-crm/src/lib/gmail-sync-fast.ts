import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptRefreshToken } from "@/lib/gmail";
import { getGmailAccountForProfile } from "@/lib/gmail-account";

const CONCURRENCY = 8;

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} manquante dans les variables d’environnement.`);
  return value;
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env("GOOGLE_GMAIL_CLIENT_ID"),
      client_secret: env("GOOGLE_GMAIL_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Renouvellement du jeton Gmail impossible.");
  }
  return json.access_token;
}

async function gmailRequest<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API ${response.status} : ${text.slice(0, 500)}`);
  }
  return await response.json() as T;
}

function decodeBase64Url(data?: string): string {
  if (!data) return "";
  try { return Buffer.from(data, "base64url").toString("utf8"); }
  catch { return ""; }
}

function findHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractAddress(value: string): string {
  const angle = value.match(/<([^>]+)>/);
  const raw = angle?.[1] || value;
  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  return (email || raw).trim().toLowerCase();
}

function extractAddressList(value: string): string[] {
  return value.split(",").map(extractAddress).filter((value) => value.includes("@"));
}

function walkParts(part: GmailPart | undefined, out: {
  text: string[];
  html: string[];
  attachments: Array<{ filename: string; mimeType: string; size: number }>;
}) {
  if (!part) return;
  const mime = part.mimeType || "";
  if (mime === "text/plain" && part.body?.data) out.text.push(decodeBase64Url(part.body.data));
  if (mime === "text/html" && part.body?.data) out.html.push(decodeBase64Url(part.body.data));
  if (part.filename) {
    out.attachments.push({
      filename: part.filename,
      mimeType: mime || "application/octet-stream",
      size: part.body?.size || 0,
    });
  }
  part.parts?.forEach((child) => walkParts(child, out));
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function parseMessage(message: GmailMessage, accountEmail: string) {
  const headers = message.payload?.headers;
  const fromRaw = findHeader(headers, "From");
  const toRaw = findHeader(headers, "To");
  const ccRaw = findHeader(headers, "Cc");
  const subject = findHeader(headers, "Subject");
  const headerMessageId = findHeader(headers, "Message-ID") || findHeader(headers, "Message-Id");
  const dateHeader = findHeader(headers, "Date");
  const parsed = {
    text: [] as string[],
    html: [] as string[],
    attachments: [] as Array<{ filename: string; mimeType: string; size: number }>,
  };
  walkParts(message.payload, parsed);
  if (!parsed.text.length && message.payload?.mimeType === "text/plain") parsed.text.push(decodeBase64Url(message.payload.body?.data));
  if (!parsed.html.length && message.payload?.mimeType === "text/html") parsed.html.push(decodeBase64Url(message.payload.body?.data));
  const html = parsed.html.join("\n").trim();
  const bodyText = parsed.text.join("\n").trim() || htmlToText(html);
  const fromEmail = extractAddress(fromRaw);
  const sentAt = message.internalDate
    ? new Date(Number(message.internalDate)).toISOString()
    : dateHeader
      ? new Date(dateHeader).toISOString()
      : new Date().toISOString();

  return {
    gmail_message_id: message.id,
    gmail_thread_id: message.threadId || null,
    header_message_id: headerMessageId || null,
    direction: fromEmail === accountEmail.toLowerCase() ? "outgoing" as const : "incoming" as const,
    from_email: fromEmail || null,
    to_emails: extractAddressList(toRaw),
    cc_emails: extractAddressList(ccRaw),
    subject: subject || null,
    body_text: bodyText || null,
    body_html: html || null,
    snippet: message.snippet || null,
    sent_at: sentAt,
    attachments: parsed.attachments,
  };
}

async function mapBatches<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const result: R[] = [];
  for (let start = 0; start < items.length; start += CONCURRENCY) {
    const batch = items.slice(start, start + CONCURRENCY);
    result.push(...await Promise.all(batch.map(worker)));
  }
  return result;
}

/** Synchronisation incrémentale strictement limitée à la boîte autorisée du profil. */
export async function syncProspectEmailsFast(
  prospectId: string,
  prospectEmail: string,
  profileId: string,
): Promise<{ newCount: number; total: number }> {
  const account = await getGmailAccountForProfile(profileId, "read");
  if (!account) return { newCount: 0, total: 0 };

  const accessToken = await getAccessToken(decryptRefreshToken(account.refresh_token_enc));
  const q = `{from:${prospectEmail} to:${prospectEmail}}`;
  const listed = await gmailRequest<{ messages?: Array<{ id: string; threadId?: string }> }>(
    accessToken,
    `/messages?maxResults=100&q=${encodeURIComponent(q)}`,
  );
  const ids = (listed.messages || []).map((message) => message.id);
  const admin = createAdminClient();

  if (!ids.length) {
    await admin.from("email_accounts").update({ last_sync_at: new Date().toISOString() }).eq("id", account.id);
    return { newCount: 0, total: 0 };
  }

  const { data: existing, error: existingError } = await admin
    .from("email_messages")
    .select("gmail_message_id")
    .eq("email_account_id", account.id)
    .in("gmail_message_id", ids);
  if (existingError) throw new Error(`Lecture de l’historique email impossible : ${existingError.message}`);

  const existingSet = new Set((existing || []).map((message) => message.gmail_message_id));
  const newIds = ids.filter((messageId) => !existingSet.has(messageId));

  if (newIds.length) {
    const parsed = await mapBatches(newIds, async (messageId) => {
      const message = await gmailRequest<GmailMessage>(
        accessToken,
        `/messages/${encodeURIComponent(messageId)}?format=full`,
      );
      return parseMessage(message, account.email);
    });

    const rows = parsed.map((message) => ({
      ...message,
      prospect_id: prospectId,
      email_account_id: account.id,
    }));
    const { error } = await admin.from("email_messages").upsert(rows, { onConflict: "email_account_id,gmail_message_id" });
    if (error) throw new Error(`Enregistrement des emails impossible : ${error.message}`);
  }

  await admin.from("email_accounts").update({ last_sync_at: new Date().toISOString() }).eq("id", account.id);
  return { newCount: newIds.length, total: ids.length };
}
