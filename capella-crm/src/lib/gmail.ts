import "server-only";

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

type GmailAccount = {
  id: string;
  email: string;
  display_name: string | null;
  refresh_token_enc: string;
  scope: string;
  is_active: boolean;
};

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
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} manquante dans les variables d’environnement.`);
  return value;
}

function oauthRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/gmail/callback`;
}

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(env("GMAIL_TOKEN_ENCRYPTION_KEY")).digest();
}

export function encryptRefreshToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64url")).join(".");
}

export function decryptRefreshToken(payload: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Jeton Gmail chiffré invalide.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function buildGmailAuthorizationUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_GMAIL_CLIENT_ID"),
    redirect_uri: oauthRedirectUri(origin),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGmailCode(origin: string, code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_GMAIL_CLIENT_ID"),
      client_secret: env("GOOGLE_GMAIL_CLIENT_SECRET"),
      redirect_uri: oauthRedirectUri(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const json = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Échange OAuth Gmail impossible.");
  }
  if (!json.refresh_token) {
    throw new Error("Google n’a pas renvoyé de refresh token. Reconnecte la boîte en acceptant de nouveau les autorisations.");
  }
  return json;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
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

export async function getActiveGmailAccount(): Promise<GmailAccount | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_accounts")
    .select("id, email, display_name, refresh_token_enc, scope, is_active")
    .eq("is_active", true)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Lecture de la boîte Gmail impossible : ${error.message}`);
  return data as GmailAccount | null;
}

async function gmailRequest<T>(
  account: GmailAccount,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = await refreshAccessToken(decryptRefreshToken(account.refresh_token_enc));
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API ${response.status} : ${text.slice(0, 500)}`);
  }
  return await response.json() as T;
}

export async function getGmailProfile(accessToken: string): Promise<{ emailAddress: string }> {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = await response.json() as { emailAddress?: string; error?: { message?: string } };
  if (!response.ok || !json.emailAddress) {
    throw new Error(json.error?.message || "Impossible de lire l’adresse Gmail connectée.");
  }
  return { emailAddress: json.emailAddress };
}

function decodeBase64Url(data?: string): string {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
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
  return value
    .split(",")
    .map(extractAddress)
    .filter((v) => v.includes("@"));
}

function walkParts(part: GmailPart | undefined, out: { text: string[]; html: string[]; attachments: Array<{ filename: string; mimeType: string; size: number }> }) {
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

function parseGmailMessage(message: GmailMessage, accountEmail: string) {
  const headers = message.payload?.headers;
  const fromRaw = findHeader(headers, "From");
  const toRaw = findHeader(headers, "To");
  const ccRaw = findHeader(headers, "Cc");
  const subject = findHeader(headers, "Subject");
  const headerMessageId = findHeader(headers, "Message-ID") || findHeader(headers, "Message-Id");
  const dateHeader = findHeader(headers, "Date");
  const parsed = { text: [] as string[], html: [] as string[], attachments: [] as Array<{ filename: string; mimeType: string; size: number }> };
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

export async function syncProspectEmails(prospectId: string, prospectEmail: string): Promise<{ newCount: number; total: number }> {
  const account = await getActiveGmailAccount();
  if (!account) return { newCount: 0, total: 0 };

  const q = `{from:${prospectEmail} to:${prospectEmail}}`;
  const listed = await gmailRequest<{ messages?: Array<{ id: string; threadId?: string }>; nextPageToken?: string }>(
    account,
    `/messages?maxResults=100&q=${encodeURIComponent(q)}`,
  );
  const ids = (listed.messages || []).map((m) => m.id);
  if (!ids.length) {
    const admin = createAdminClient();
    await admin.from("email_accounts").update({ last_sync_at: new Date().toISOString() }).eq("id", account.id);
    return { newCount: 0, total: 0 };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("email_messages")
    .select("gmail_message_id")
    .in("gmail_message_id", ids);
  const existingSet = new Set((existing || []).map((m) => m.gmail_message_id));

  const parsed = [] as ReturnType<typeof parseGmailMessage>[];
  for (const id of ids) {
    const message = await gmailRequest<GmailMessage>(account, `/messages/${encodeURIComponent(id)}?format=full`);
    parsed.push(parseGmailMessage(message, account.email));
  }

  if (parsed.length) {
    const rows = parsed.map((m) => ({
      ...m,
      prospect_id: prospectId,
      email_account_id: account.id,
    }));
    const { error } = await admin.from("email_messages").upsert(rows, { onConflict: "gmail_message_id" });
    if (error) throw new Error(`Enregistrement des emails impossible : ${error.message}`);
  }

  await admin.from("email_accounts").update({ last_sync_at: new Date().toISOString() }).eq("id", account.id);
  return { newCount: ids.filter((id) => !existingSet.has(id)).length, total: ids.length };
}

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: Buffer | string): string {
  const encoded = Buffer.isBuffer(value)
    ? value.toString("base64")
    : Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

export type GmailAttachment = {
  fileName: string;
  mime: string;
  data: Buffer;
};

export async function sendGmailMessage(input: {
  to: string;
  subject: string;
  body: string;
  attachments?: GmailAttachment[];
  threadId?: string | null;
  inReplyTo?: string | null;
}): Promise<{ id: string; threadId?: string }> {
  const account = await getActiveGmailAccount();
  if (!account) throw new Error("Aucune boîte Gmail active n’est configurée.");

  const boundary = `capella_${crypto.randomBytes(12).toString("hex")}`;
  const headers = [
    `From: ${account.display_name ? `${encodeHeader(account.display_name)} <${account.email}>` : account.email}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
  ];
  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`);
    headers.push(`References: ${input.inReplyTo}`);
  }

  const attachments = input.attachments || [];
  let mime = "";
  if (!attachments.length) {
    mime = [
      ...headers,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(input.body),
    ].join("\r\n");
  } else {
    mime = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(input.body),
      ...attachments.flatMap((attachment) => [
        `--${boundary}`,
        `Content-Type: ${attachment.mime || "application/octet-stream"}; name="${attachment.fileName.replace(/\"/g, "")}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${attachment.fileName.replace(/\"/g, "")}"`,
        "",
        wrapBase64(attachment.data),
      ]),
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }

  const raw = Buffer.from(mime, "utf8").toString("base64url");
  return await gmailRequest<{ id: string; threadId?: string }>(account, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }),
  });
}
