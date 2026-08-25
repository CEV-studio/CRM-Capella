import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("prospects")
    .update({ acd_downloaded_at: new Date().toISOString() })
    .eq("id", id)
    .eq("stage", "Demande ACD")
    .is("deleted_at", null);

  if (error) {
    return new NextResponse(`Impossible de marquer l'ACD comme téléchargée : ${error.message}`, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/api/acd/${id}`, request.url), 302);
}
