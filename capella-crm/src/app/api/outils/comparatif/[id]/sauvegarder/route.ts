import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PIECES, cheminPiece, TAILLE_MAX } from "@/lib/supabase/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: prospect } = await supabase
    .from("prospects")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!prospect) return new NextResponse("Prospect introuvable", { status: 404 });

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return new NextResponse("PDF vide", { status: 400 });
  if (bytes.length > TAILLE_MAX) return new NextResponse("PDF trop lourd", { status: 413 });

  const brut = request.headers.get("x-file-name") || `Comparatif_${new Date().toISOString().slice(0, 10)}.pdf`;
  const fileName = (brut.startsWith("Comparatif_") ? brut : `Comparatif_${brut}`)
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .slice(-120);
  const chemin = cheminPiece("prospect", id, fileName);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_PIECES)
    .upload(chemin, bytes, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    return new NextResponse(`Stockage impossible : ${uploadError.message}`, { status: 500 });
  }

  const { error: insertError } = await supabase.from("pieces_jointes").insert({
    type: "Facture",
    prospect_id: id,
    affaire_id: null,
    bucket_path: chemin,
    file_name: fileName,
    mime: "application/pdf",
    taille: bytes.length,
  });

  if (insertError) {
    await supabase.storage.from(BUCKET_PIECES).remove([chemin]);
    return new NextResponse(`Enregistrement impossible : ${insertError.message}`, { status: 500 });
  }

  return NextResponse.json({ ok: true, fileName });
}
