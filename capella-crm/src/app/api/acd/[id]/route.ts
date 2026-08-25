import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function nomComplet(nom: string | null, prenom: string | null) {
  return [prenom, nom].filter(Boolean).join(" ").trim();
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").trim() || "prospect";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: prospect, error } = await supabase
    .from("prospects")
    .select("id, stage, raison_sociale, nom, prenom, mail, tel_mobile, tel_fixe, siren, pdl, pce")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !prospect) {
    return Response.json({ error: "Prospect introuvable." }, { status: 404 });
  }
  if (prospect.stage !== "Demande ACD") {
    return Response.json(
      { error: "Le prospect doit être à l'étape Demande ACD." },
      { status: 400 },
    );
  }

  const nomPrenom = nomComplet(prospect.nom, prospect.prenom);
  const telephone = prospect.tel_mobile || prospect.tel_fixe || "";
  const raisonSociale = prospect.raison_sociale || "";
  const identifiantSociete = prospect.siren || "";
  const email = prospect.mail || "";

  const manquants: string[] = [];
  if (!nomPrenom) manquants.push("nom/prénom");
  if (!raisonSociale) manquants.push("raison sociale");
  if (!identifiantSociete) manquants.push("SIRET/SIREN");
  if (!email) manquants.push("email");
  if (!telephone) manquants.push("téléphone");

  if (manquants.length) {
    return Response.json(
      { error: `Impossible de générer l'ACD. Champs manquants : ${manquants.join(", ")}.` },
      { status: 400 },
    );
  }

  const secret = process.env.FORM_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { error: "FORM_WEBHOOK_SECRET n'est pas configuré sur Vercel." },
      { status: 500 },
    );
  }

  const response = await fetch(`${req.nextUrl.origin}/api/generate-acd`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-capella-internal-secret": secret,
    },
    body: JSON.stringify({
      nom_prenom: nomPrenom,
      nom_societe: raisonSociale,
      siret: identifiantSociete,
      mail: email,
      telephone,
      pdl: prospect.pdl || "",
      pce: prospect.pce || "",
      fait_a: "",
      date_signature: "",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { error: `Erreur génération ACD : ${detail || response.status}` },
      { status: 502 },
    );
  }

  const pdf = await response.arrayBuffer();
  const filename = `ACD_${safeFilename(raisonSociale)}_${safeFilename(nomPrenom)}.pdf`;

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
