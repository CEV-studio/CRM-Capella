import { createClient } from "@/lib/supabase/server";

const LOGO_JPEG_B64 = "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";

function nomComplet(nom: string | null, prenom: string | null) {
  return [prenom, nom].filter(Boolean).join(" ").trim();
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").trim() || "prospect";
}

function pdfEscape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/…/g, "...")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/€/g, "EUR");
}

function latin1(value: string) {
  return Buffer.from(pdfEscape(value), "latin1");
}

function estimateWidth(text: string, size: number, bold = false) {
  return text.length * size * (bold ? 0.54 : 0.5);
}

function wrapText(text: string, maxWidth: number, size: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (estimateWidth(candidate, size) <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textCommand(text: string, x: number, y: number, size = 10, bold = false) {
  return Buffer.concat([
    Buffer.from(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (`),
    latin1(text),
    Buffer.from(") Tj ET\n"),
  ]);
}

function centeredText(text: string, y: number, size = 10, bold = false) {
  const pageWidth = 595.28;
  const x = Math.max(40, (pageWidth - estimateWidth(text, size, bold)) / 2);
  return textCommand(text, x, y, size, bold);
}

function buildAcdPdf(data: {
  nomPrenom: string;
  societe: string;
  immatriculation: string;
  mail: string;
  telephone: string;
  pdl: string;
  pce: string;
}) {
  const logo = Buffer.from(LOGO_JPEG_B64, "base64");
  const chunks: Buffer[] = [];
  chunks.push(Buffer.from("q 180 0 0 93.9 207.6 724 cm /Im1 Do Q\n"));
  chunks.push(centeredText("AUTORISATION POUR LA RECUPERATION DES DONNEES AUPRES", 703, 10.5, true));
  chunks.push(centeredText("DES GESTIONNAIRES DE RESEAUX", 688, 10.5, true));

  let y = 655;
  chunks.push(textCommand(`Je soussigné ${data.nomPrenom} agissant en qualité de gérant de la société ${data.societe}`, 56.7, y, 10));
  y -= 22;
  chunks.push(textCommand(`immatriculée sous le numéro ${data.immatriculation}`, 56.7, y, 10));
  y -= 22;
  chunks.push(textCommand(`Mail : ${data.mail}`, 56.7, y, 10));
  y -= 17;
  chunks.push(textCommand(`Tel : ${data.telephone}`, 56.7, y, 10));
  y -= 30;
  chunks.push(textCommand("et ayant tous pouvoirs pour engager ladite société,", 56.7, y, 10));
  y -= 31;

  const auth = "Donne expressément mon accord à Hello Energy et ses fournisseurs d'énergies partenaires pour recueillir auprès des gestionnaires de réseaux de gaz et d'électricité les données techniques et contractuelles (consommation et profil, tarif d'acheminement, capacité journalière en gaz, puissance et courbe de charge en électricité) associées aux points de livraisons de la société que je représente et dont les PDL/PCE (points de livraison/points comptage estimation) sont les suivants :";
  for (const line of wrapText(auth, 482, 9.5)) {
    chunks.push(textCommand(line, 56.7, y, 9.5));
    y -= 14;
  }
  y -= 10;

  chunks.push(textCommand("PDL :", 56.7, y, 10));
  y -= 18;
  const pdls = data.pdl.split(/[,;\n]+/).map((v) => v.trim()).filter(Boolean);
  for (const pdl of pdls.slice(0, 4)) {
    chunks.push(textCommand(`- ${pdl}`, 70, y, 10, true));
    y -= 17;
  }
  chunks.push(textCommand("- .................................................................", 70, y, 10));
  y -= 26;

  chunks.push(textCommand("PCE :", 56.7, y, 10));
  y -= 18;
  const pces = data.pce.split(/[,;\n]+/).map((v) => v.trim()).filter(Boolean);
  for (const pce of pces.slice(0, 4)) {
    chunks.push(textCommand(`- ${pce}`, 70, y, 10, true));
    y -= 17;
  }
  chunks.push(textCommand("- .................................................................", 70, y, 10));
  y -= 17;
  chunks.push(textCommand("- .................................................................", 70, y, 10));
  y -= 31;

  chunks.push(textCommand("En vue de la préparation d'une offre de fourniture de gaz et/ou d'électricité.", 56.7, y, 10));
  y -= 22;
  chunks.push(textCommand("La présente autorisation est conclue pour une durée de douze (12) mois à compter de sa signature.", 56.7, y, 9.7));
  y -= 42;
  chunks.push(textCommand("Fait à", 56.7, y, 10));
  chunks.push(textCommand("le", 300, y, 10));
  y -= 28;
  chunks.push(textCommand("Signature :", 56.7, y, 10));

  chunks.push(Buffer.from("0.8 G 0.5 w 56.7 55 m 538.6 55 l S\n"));
  chunks.push(Buffer.from("q 86 0 0 44.9 56.7 8 cm /Im1 Do Q\n"));
  chunks.push(Buffer.from("0.8 G 0.5 w 151 18 m 151 46 l S\n"));
  chunks.push(textCommand("Hello Energy SAS", 163, 35, 8, true));
  chunks.push(textCommand("20 impasse d'Agen - 33800 Bordeaux, France - SIRET : 939 973 713 00014", 163, 22, 7.2));

  const content = Buffer.concat(chunks);
  const objects: Buffer[] = [];
  objects[1] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects[3] = Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 7 0 R >>");
  objects[4] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects[5] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  objects[6] = Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width 420 /Height 219 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`),
    logo,
    Buffer.from("\nendstream"),
  ]);
  objects[7] = Buffer.concat([
    Buffer.from(`<< /Length ${content.length} >>\nstream\n`),
    content,
    Buffer.from("endstream"),
  ]);

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  let offset = parts[0].length;
  for (let i = 1; i <= 7; i++) {
    offsets[i] = offset;
    const part = Buffer.concat([Buffer.from(`${i} 0 obj\n`), objects[i], Buffer.from("\nendobj\n")]);
    parts.push(part);
    offset += part.length;
  }
  const xrefOffset = offset;
  let xref = "xref\n0 8\n0000000000 65535 f \n";
  for (let i = 1; i <= 7; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(Buffer.from(xref + trailer));
  return Buffer.concat(parts);
}

export async function GET(
  _req: Request,
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

  if (error || !prospect) return Response.json({ error: "Prospect introuvable." }, { status: 404 });
  if (prospect.stage !== "Demande ACD") {
    return Response.json({ error: "Le prospect doit être à l'étape Demande ACD." }, { status: 400 });
  }

  const nomPrenom = nomComplet(prospect.nom, prospect.prenom);
  const telephone = prospect.tel_mobile || prospect.tel_fixe || "";
  const societe = prospect.raison_sociale || "";
  const immatriculation = prospect.siren || "";
  const mail = prospect.mail || "";
  const manquants: string[] = [];
  if (!nomPrenom) manquants.push("nom/prénom");
  if (!societe) manquants.push("raison sociale");
  if (!immatriculation) manquants.push("SIRET/SIREN");
  if (!mail) manquants.push("email");
  if (!telephone) manquants.push("téléphone");
  if (manquants.length) {
    return Response.json({ error: `Impossible de générer l'ACD. Champs manquants : ${manquants.join(", ")}.` }, { status: 400 });
  }

  const pdf = buildAcdPdf({
    nomPrenom,
    societe,
    immatriculation,
    mail,
    telephone,
    pdl: prospect.pdl || "",
    pce: prospect.pce || "",
  });
  const filename = `ACD_${safeFilename(societe)}_${safeFilename(nomPrenom)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
