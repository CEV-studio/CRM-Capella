import { requireProfile } from "@/lib/auth";

export const runtime = "nodejs";

function clean(s: string) {
  return s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u202F|\u00A0/g, " ");
}

function pdfEsc(s: string) {
  return clean(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

function wrap(text: string, max = 92) {
  const words = clean(text).split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if ((line + " " + word).length <= max) line += " " + word;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}

type PdfLine = { text: string; bold?: boolean; gapAfter?: number };

function buildPdf(lines: PdfLine[]) {
  const commands: string[] = [];
  let y = 800;
  for (const line of lines) {
    commands.push(`BT /${line.bold ? "F2" : "F1"} 10 Tf 1 0 0 1 60 ${y} Tm (${pdfEsc(line.text)}) Tj ET`);
    y -= 14 + (line.gapAfter ?? 0);
  }
  const content = Buffer.from(commands.join("\n"), "latin1");

  const objects: Buffer[] = [];
  const add = (s: string | Buffer) => objects.push(Buffer.isBuffer(s) ? s : Buffer.from(s, "latin1"));
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>");
  add(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"), content, Buffer.from("\nendstream", "latin1")]));
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets = [0];
  let size = parts[0].length;
  objects.forEach((obj, i) => {
    offsets.push(size);
    const wrapped = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), obj, Buffer.from("\nendobj\n", "latin1")]);
    parts.push(wrapped);
    size += wrapped.length;
  });
  const xrefOffset = size;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}

export async function POST(request: Request) {
  await requireProfile();
  const form = await request.formData();
  const get = (name: string) => String(form.get(name) ?? "").trim();
  const data = {
    nom_societe: get("nom_societe"), adresse_societe: get("adresse_societe"), adresse_fournisseur: get("adresse_fournisseur"),
    nom_gerant: get("nom_gerant"), siret: get("siret"), pdl: get("pdl"), echeance: get("echeance"),
    email: get("email"), adresse_postale: get("adresse_postale"),
  };
  if (Object.values(data).some((v) => !v)) return new Response("Champs obligatoires manquants", { status: 400 });

  const dateJour = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" }).format(new Date());
  const lines: PdfLine[] = [];
  const para = (text: string, gap = 8) => {
    const wrapped = wrap(text);
    wrapped.forEach((t, i) => lines.push({ text: t, gapAfter: i === wrapped.length - 1 ? gap : 0 }));
  };
  lines.push({ text: data.nom_societe, bold: true });
  para(data.adresse_societe, 18);
  para(data.adresse_fournisseur, 18);
  lines.push({ text: `Compte client : ${data.nom_societe}` });
  lines.push({ text: `Réf. SIRET / SIREN : ${data.siret}` });
  lines.push({ text: `Date : ${dateJour}`, gapAfter: 16 });
  lines.push({ text: "Objet : Résiliation du contrat de fourniture d'énergie", bold: true });
  lines.push({ text: "Recommandé avec Accusé de Réception", bold: true, gapAfter: 16 });
  para(`Je soussigné(e), ${data.nom_gerant}, dûment habilité(e) à représenter la société ${data.nom_societe}, enregistrée sous le numéro ${data.siret}, vous demande par la présente de bien vouloir mettre fin au contrat de fourniture d'énergie du point de livraison n° ${data.pdl}.`);
  para(`Suite à notre discussion téléphonique durant laquelle nous avons pu valider les éléments de ce courrier, je souhaiterais que cette résiliation soit effective à la date d'anniversaire, à l'échéance prévue soit le ${data.echeance} à minuit.`);
  para("Cette demande respecte le préavis de résiliation contractuel, comme vous nous l'avez confirmé. Ce courrier est dupliqué d'un envoi par mail.");
  para("Ainsi, conformément aux dispositions dudit contrat, ce dernier sera résilié de plein droit à la date indiquée ci-dessus.");
  para("À compter de cette date, le site sera rattaché au périmètre d'équilibre d'un autre fournisseur d'énergie.");
  para(`Je souhaiterais recevoir une facture de clôture de compte et une confirmation écrite par mail à ${data.email} ou par courrier postal à ${data.nom_societe}, ${data.adresse_postale}.`);
  para("Vous souhaitant bonne réception de ce courrier, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.", 18);
  lines.push({ text: "Date                              Signature + tampon" });

  const pdf = buildPdf(lines);
  const safeName = data.nom_societe.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60) || "client";
  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="resiliation_${safeName}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
