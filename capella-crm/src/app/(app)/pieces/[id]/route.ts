import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PIECES } from "@/lib/supabase/storage";

/**
 * Téléchargement d'une pièce jointe.
 * On ne sert jamais d'URL publique : on vérifie le droit (RLS) puis on génère
 * une URL signée valable une minute, le temps de récupérer le fichier.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireProfile();
  const { id } = await params;

  const supabase = await createClient();

  // RLS : la pièce ne remonte que si l'utilisateur a le droit de la voir.
  const { data: piece } = await supabase
    .from("pieces_jointes")
    .select("bucket_path")
    .eq("id", id)
    .maybeSingle();

  if (!piece) {
    return new NextResponse("Introuvable", { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from(BUCKET_PIECES)
    .createSignedUrl(piece.bucket_path, 60);

  if (error || !signed) {
    return new NextResponse("Fichier indisponible", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
