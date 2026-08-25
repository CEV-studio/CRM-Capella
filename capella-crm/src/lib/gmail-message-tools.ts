import "server-only";

import crypto from "node:crypto";
import { decryptRefreshToken, getActiveGmailAccount, type GmailAttachment } from "@/lib/gmail";

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} manquante dans les variables d’environnement.`);
  return value;
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

async function gmailJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const account = await getActiveGmailAccount();
  if (!account) throw new Error("Aucune boîte Gmail active n’est configurée.");
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

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: Buffer | string): string {
  const encoded = Buffer.isBuffer(value)
    ? value.toString("base64")
    : Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

function safeHeaderFileName(value: string): string {
  return value.replace(/[\r\n\"]/g, "_");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function getGmailSignature(sendAsEmail: string): Promise<string> {
  try {
    const settings = await gmailJson<{ signature?: string }>(
      `/settings/sendAs/${encodeURIComponent(sendAsEmail)}`,
    );
    return settings.signature?.trim() || "";
  } catch (error) {
    // Une signature ne doit jamais empêcher l'envoi d'un message.
    console.error("Lecture de la signature Gmail impossible :", error);
    return "";
  }
}

function buildAlternativeParts(body: string, signatureHtml: string, boundary: string): string[] {
  const bodyHtml = escapeHtml(body).replace(/\r?\n/g, "<br>");
  const html = signatureHtml
    ? `<div>${bodyHtml}</div><br><div class="gmail_signature">${signatureHtml}</div>`
    : `<div>${bodyHtml}</div>`;
  const signatureText = signatureHtml ? htmlToText(signatureHtml) : "";
  const plain = signatureText ? `${body}\n\n${signatureText}` : body;

  return [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(plain),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(html),
    `--${boundary}--`,
  ];
}

export async function sendGmailMessageAdvanced(input: {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: GmailAttachment[];
  threadId?: string | null;
  inReplyTo?: string | null;
}): Promise<{ id: string; threadId?: string }> {
  const account = await getActiveGmailAccount();
  if (!account) throw new Error("Aucune boîte Gmail active n’est configurée.");

  const signatureHtml = await getGmailSignature(account.email);
  const mixedBoundary = `capella_mixed_${crypto.randomBytes(12).toString("hex")}`;
  const alternativeBoundary = `capella_alt_${crypto.randomBytes(12).toString("hex")}`;
  const headers = [
    `From: ${account.display_name ? `${encodeHeader(account.display_name)} <${account.email}>` : account.email}`,
    `To: ${input.to}`,
  ];
  if (input.cc?.length) headers.push(`Cc: ${input.cc.join(", ")}`);
  if (input.bcc?.length) headers.push(`Bcc: ${input.bcc.join(", ")}`);
  headers.push(`Subject: ${encodeHeader(input.subject)}`);
  headers.push("MIME-Version: 1.0");

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`);
    headers.push(`References: ${input.inReplyTo}`);
  }

  const attachments = input.attachments || [];
  let mime: string;
  if (!attachments.length) {
    mime = [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      ...buildAlternativeParts(input.body, signatureHtml, alternativeBoundary),
      "",
    ].join("\r\n");
  } else {
    mime = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      "",
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      ...buildAlternativeParts(input.body, signatureHtml, alternativeBoundary),
      ...attachments.flatMap((attachment) => {
        const name = safeHeaderFileName(attachment.fileName);
        return [
          `--${mixedBoundary}`,
          `Content-Type: ${attachment.mime || "application/octet-stream"}; name="${name}"`,
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${name}"`,
          "",
          wrapBase64(attachment.data),
        ];
      }),
      `--${mixedBoundary}--`,
      "",
    ].join("\r\n");
  }

  const raw = Buffer.from(mime, "utf8").toString("base64url");
  return await gmailJson<{ id: string; threadId?: string }>("/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }),
  });
}

type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};

type GmailMessage = { payload?: GmailPart };

function collectAttachments(part: GmailPart | undefined, out: GmailPart[]) {
  if (!part) return;
  if (part.filename) out.push(part);
  part.parts?.forEach((child) => collectAttachments(child, out));
}

export async function downloadGmailAttachment(messageId: string, attachmentIndex: number): Promise<{
  data: Buffer;
  fileName: string;
  mime: string;
}> {
  const message = await gmailJson<GmailMessage>(`/messages/${encodeURIComponent(messageId)}?format=full`);
  const parts: GmailPart[] = [];
  collectAttachments(message.payload, parts);
  const part = parts[attachmentIndex];
  if (!part?.filename) throw new Error("Pièce jointe Gmail introuvable.");

  let data: Buffer;
  if (part.body?.attachmentId) {
    const attachment = await gmailJson<{ data?: string }>(
      `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(part.body.attachmentId)}`,
    );
    if (!attachment.data) throw new Error("Contenu de la pièce jointe Gmail indisponible.");
    data = Buffer.from(attachment.data, "base64url");
  } else if (part.body?.data) {
    data = Buffer.from(part.body.data, "base64url");
  } else {
    throw new Error("Contenu de la pièce jointe Gmail indisponible.");
  }

  return {
    data,
    fileName: part.filename,
    mime: part.mimeType || "application/octet-stream",
  };
}
