import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncProspectEmails } from "@/lib/gmail";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, mail")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!prospect) return NextResponse.json({ error: "Prospect introuvable." }, { status: 404 });
  if (!prospect.mail?.trim()) return NextResponse.json({ error: "Aucune adresse email sur la fiche." }, { status: 400 });

  try {
    const result = await syncProspectEmails(id, prospect.mail.trim());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Synchronisation Gmail impossible." }, { status: 500 });
  }
}
