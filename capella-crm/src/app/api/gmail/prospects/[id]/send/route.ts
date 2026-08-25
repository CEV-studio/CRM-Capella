import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_PIECES } from "@/lib/supabase/storage";
import { type GmailAttachment } from "@/lib/gmail";
import { syncProspectEmailsFast } from "@/lib/gmail-sync-fast";
import { sendGmailMessageAdvanced } from "@/lib/gmail-message-tools";

const MAX_TOTAL = 18 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipients(raw: string): string[] {
  const values = raw
    .split(/[;,]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(values)];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, mail")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!prospect) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });
  if (!prospect.mail?.trim()) return NextResponse.json({ error: "Ce prospect n’a pas d’adresse email." }, { status: 400 });

  const form = await request.formData();
  const subject = String(form.get("subject") || "").trim();
  const body = String(form.get("body") || "").trim();
  const templateId = String(form.get("templateId") || "").trim() || null;
  const threadId = String(form.get("threadId") || "").trim() || null;
  const inReplyTo = String(form.get("inReplyTo") || "").trim() || null;
  const cc = parseRecipients(String(form.get("cc") || ""));
  const bcc = parseRecipients(String(form.get("bcc") || ""));

  if (!subject) return NextResponse.json({ error: "L’objet est obligatoire." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Le contenu du mail est obligatoire." }, { status: 400 });

  const invalidRecipient = [...cc, ...bcc].find((email) => !EMAIL_RE.test(email));
  if (invalidRecipient) {
    return NextResponse.json({ error: `Adresse email invalide : ${invalidRecipient}` }, { status: 400 });
  }

  let attachmentIds: string[] = [];
  try {
    const rawIds = String(form.get("attachmentIds") || "[]");
    const parsed = JSON.parse(rawIds) as unknown;
    attachmentIds = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && Boolean(value)).slice(0, MAX_ATTACHMENTS) : [];
  } catch {
    return NextResponse.json({ error: "Liste des pièces jointes invalide." }, { status: 400 });
  }

  const uploadedFiles = form
    .getAll("files")
    .filter((value): value is File => typeof value !== "string" && value.size > 0)
    .slice(0, MAX_ATTACHMENTS);

  if (attachmentIds.length + uploadedFiles.length > MAX_ATTACHMENTS) {
    return NextResponse.json({ error: "10 pièces jointes maximum par email." }, { status: 400 });
  }

  const attachments: GmailAttachment[] = [];
  let totalSize = 0;

  if (attachmentIds.length) {
    const { data: pieces, error } = await supabase
      .from("pieces_jointes")
      .select("id, type, bucket_path, file_name, mime, taille")
      .eq("prospect_id", id)
      .in("id", attachmentIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    for (const piece of pieces || []) {
      if (piece.type === "ACD" && profile.role !== "admin") continue;
      const { data: file, error: storageError } = await supabase.storage.from(BUCKET_PIECES).download(piece.bucket_path);
      if (storageError || !file) {
        return NextResponse.json({ error: `Pièce jointe indisponible : ${piece.file_name}` }, { status: 400 });
      }
      const data = Buffer.from(await file.arrayBuffer());
      totalSize += data.byteLength;
      if (totalSize > MAX_TOTAL) {
        return NextResponse.json({ error: "Les pièces jointes sont trop lourdes pour un envoi Gmail (18 Mo maximum dans le CRM)." }, { status: 400 });
      }
      attachments.push({ fileName: piece.file_name, mime: piece.mime || "application/octet-stream", data });
    }
  }

  for (const file of uploadedFiles) {
    totalSize += file.size;
    if (totalSize > MAX_TOTAL) {
      return NextResponse.json({ error: "Les pièces jointes sont trop lourdes pour un envoi Gmail (18 Mo maximum dans le CRM)." }, { status: 400 });
    }
    attachments.push({
      fileName: file.name || "piece-jointe",
      mime: file.type || "application/octet-stream",
      data: Buffer.from(await file.arrayBuffer()),
    });
  }

  try {
    const sent = await sendGmailMessageAdvanced({
      to: prospect.mail.trim(),
      cc,
      bcc,
      subject,
      body,
      attachments,
      threadId,
      inReplyTo,
      profileId: profile.id,
    });

    await syncProspectEmailsFast(id, prospect.mail.trim());
    const admin = createAdminClient();
    await admin.from("email_messages").update({
      triggered_by: profile.id,
      template_id: templateId,
    }).eq("gmail_message_id", sent.id);

    return NextResponse.json({ ok: true, messageId: sent.id, threadId: sent.threadId || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi Gmail impossible." }, { status: 500 });
  }
}
