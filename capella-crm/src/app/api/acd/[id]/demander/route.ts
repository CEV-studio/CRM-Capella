import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Le commercial ne génère ni ne télécharge aucun PDF.
 * Le fait que le prospect soit à l'étape « Demande ACD » suffit à le faire
 * apparaître dans la file d'attente administrateur.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, stage")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!prospect) {
    return new NextResponse("Prospect introuvable", { status: 404 });
  }

  if (prospect.stage !== "Demande ACD") {
    return new NextResponse(
      "Le prospect doit être à l'étape Demande ACD",
      { status: 400 },
    );
  }

  // Aucun fichier n'est créé ici : la génération est strictement réservée
  // à l'admin depuis la page « ACD à traiter ».
  return NextResponse.redirect(
    new URL(`/prospection/${id}?acd=transmise`, request.url),
    303,
  );
}
