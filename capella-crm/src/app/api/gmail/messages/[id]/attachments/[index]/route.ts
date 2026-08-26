import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { downloadGmailAttachment } from "@/lib/gmail-message-tools";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  await requireProfile();
  const { id, index: rawIndex } = await params;
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Pièce jointe invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: message, error } = await supabase
    .from("email_messages")
    .select("id, email_account_id, gmail_message_id, attachments")
    .eq("id", id)
    .maybeSingle();

  if (error || !message) {
    return NextResponse.json({ error: "Email introuvable ou inaccessible." }, { status: 404 });
  }
  if (!message.email_account_id) {
    return NextResponse.json({ error: "Boîte Gmail liée à cet email introuvable." }, { status: 404 });
  }

  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (index >= attachments.length) {
    return NextResponse.json({ error: "Pièce jointe introuvable." }, { status: 404 });
  }

  try {
    const file = await downloadGmailAttachment(message.email_account_id, message.gmail_message_id, index);
    return new Response(new Uint8Array(file.data), {
      headers: {
        "content-type": file.mime,
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (downloadError) {
    return NextResponse.json(
      { error: downloadError instanceof Error ? downloadError.message : "Téléchargement impossible." },
      { status: 502 },
    );
  }
}
