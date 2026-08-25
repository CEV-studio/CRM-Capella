import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_PIECES } from "@/lib/supabase/storage";
import { sendGmailMessage, syncProspectEmails, type GmailAttachment } from "@/lib/gmail";

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

  const payload = await request.json() as {
    subject?: string;
    body?: string;
    templateId?: string | null;
    attachmentIds?: string[];
    threadId?: string | null;
    inReplyTo?: string | null;
  };
  const subject = String(payload.subject || "").trim();
  const body = String(payload.body || "").trim();
  if (!subject) return NextResponse.json({ error: "L’objet est obligatoire." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Le contenu du mail est obligatoire." }, { status: 400 });

  const attachmentIds = Array.isArray(payload.attachmentIds) ? payload.attachmentIds.filter(Boolean).slice(0, 10) : [];
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
      attachments.push({ fileName: piece.file_name, mime: piece.mime || "application/octet-stream", data });
    }
  }

  if (totalSize > 18 * 1024 * 1024) {
    return NextResponse.json({ error: "Les pièces jointes sont trop lourdes pour un envoi Gmail (18 Mo maximum dans le CRM)." }, { status: 400 });
  }

  try {
    const sent = await sendGmailMessage({
      to: prospect.mail.trim(),
      subject,
      body,
      attachments,
      threadId: payload.threadId || null,
      inReplyTo: payload.inReplyTo || null,
    });

    await syncProspectEmails(id, prospect.mail.trim());
    const admin = createAdminClient();
    await admin.from("email_messages").update({
      triggered_by: profile.id,
      template_id: payload.templateId || null,
    }).eq("gmail_message_id", sent.id);

    return NextResponse.json({ ok: true, messageId: sent.id, threadId: sent.threadId || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi Gmail impossible." }, { status: 500 });
  }
}
