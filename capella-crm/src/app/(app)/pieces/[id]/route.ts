import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PIECES } from "@/lib/supabase/storage";

/** Téléchargement privé d'une pièce jointe. Les ACD sont réservées à l'admin. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: piece } = await supabase
    .from("pieces_jointes")
    .select("bucket_path, type")
    .eq("id", id)
    .maybeSingle();

  if (!piece) return new NextResponse("Introuvable", { status: 404 });
  if (piece.type === "ACD" && profile.role !== "admin") {
    return new NextResponse("Accès réservé à l'administrateur", { status: 403 });
  }

  const { data: signed, error } = await supabase.storage
    .from(BUCKET_PIECES)
    .createSignedUrl(piece.bucket_path, 60);

  if (error || !signed) return new NextResponse("Fichier indisponible", { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
