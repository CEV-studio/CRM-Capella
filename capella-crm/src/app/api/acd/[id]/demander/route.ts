import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_PIECES, cheminPiece } from "@/lib/supabase/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, raison_sociale, stage")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!prospect) return new NextResponse("Prospect introuvable", { status: 404 });
  if (prospect.stage !== "Demande ACD") {
    return new NextResponse("Le prospect doit être à l'étape Demande ACD", { status: 400 });
  }

  const cookie = request.headers.get("cookie") ?? "";
  const pdfResponse = await fetch(new URL(`/api/acd/${id}`, request.url), {
    headers: { cookie },
    cache: "no-store",
  });

  if (!pdfResponse.ok) {
    const detail = await pdfResponse.text().catch(() => "");
    return new NextResponse(`Génération ACD impossible${detail ? ` : ${detail}` : ""}`, { status: 502 });
  }

  const pdf = await pdfResponse.arrayBuffer();
  const nomSociete = (prospect.raison_sociale || "prospect")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .slice(0, 80);
  const fileName = `ACD_${nomSociete}_${new Date().toISOString().slice(0, 10)}.pdf`;
  const chemin = cheminPiece("prospect", id, fileName);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_PIECES)
    .upload(chemin, pdf, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    return new NextResponse(`Stockage impossible : ${uploadError.message}`, { status: 500 });
  }

  const { error: insertError } = await supabase.from("pieces_jointes").insert({
    type: "ACD",
    prospect_id: id,
    affaire_id: null,
    bucket_path: chemin,
    file_name: fileName,
    mime: "application/pdf",
    taille: pdf.byteLength,
  });

  if (insertError) {
    await supabase.storage.from(BUCKET_PIECES).remove([chemin]);
    return new NextResponse(`Enregistrement impossible : ${insertError.message}`, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/prospection/${id}?acd=transmise`, request.url), 303);
}
