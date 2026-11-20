import { NextResponse } from "next/server";
import { requireAdv } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdv();
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.rpc("adv_acd_download", {p_id:id});

  if (error) {
    return new NextResponse(`Impossible de marquer l'ACD comme téléchargée : ${error.message}`, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/api/acd/${id}`, request.url), 302);
}
