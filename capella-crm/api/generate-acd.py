import base64
import io
import json
import os
from http.server import BaseHTTPRequestHandler

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

# Version compacte du logo fourni par Jeremy, embarquée pour que la fonction
# soit autonome sur Vercel (aucun fichier local/secrets nécessaires).
LOGO_B64 = "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"


def clean(v):
    return str(v or "").strip()


def build_pdf(data):
    output = io.BytesIO()
    page_w, _ = A4
    ml = 20 * mm
    mr = 20 * mm
    mt = 15 * mm
    mb = 28 * mm
    content_w = page_w - ml - mr

    normal = ParagraphStyle("normal", fontName="Helvetica", fontSize=10, leading=15, textColor=colors.HexColor("#222222"))
    bold_p = ParagraphStyle("bold_p", parent=normal, fontName="Helvetica-Bold")
    title_s = ParagraphStyle("title_s", fontName="Helvetica-Bold", fontSize=10.5, leading=14, alignment=TA_CENTER, textColor=colors.HexColor("#222222"))
    justify = ParagraphStyle("justify", parent=normal, alignment=TA_JUSTIFY, leading=16)

    logo_bytes = base64.b64decode(LOGO_B64)
    logo_stream = io.BytesIO(logo_bytes)

    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=ml, rightMargin=mr, topMargin=mt, bottomMargin=mb)
    story = []
    logo = Image(logo_stream, width=65 * mm, height=34 * mm)
    logo.hAlign = "CENTER"
    story.extend([logo, Spacer(1, 4 * mm)])
    story.append(Paragraph("AUTORISATION POUR LA RECUPERATION DES DONNEES AUPRES DES GESTIONNAIRES DE RESEAUX", title_s))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(f'Je soussigné <b>{clean(data.get("nom_prenom"))}</b> agissant en qualité de gérant de la société <b>{clean(data.get("nom_societe"))}</b>', normal))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(f'immatriculée sous le numéro <b>{clean(data.get("siret"))}</b>', normal))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(f'Mail : <b>{clean(data.get("mail"))}</b>', normal))
    story.append(Spacer(1, 1 * mm))
    story.append(Paragraph(f'Tel : <b>{clean(data.get("telephone"))}</b>', normal))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("et ayant tous pouvoirs pour engager ladite société,", normal))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("<b>Donne expressément mon accord</b> à Hello Energy et ses <b>fournisseurs d'énergies partenaires</b> pour recueillir auprès des gestionnaires de réseaux de gaz et d'électricité les données techniques et contractuelles (consommation et profil, tarif d'acheminement, capacité journalière en gaz, puissance et courbe de charge en électricité) associées aux points de livraisons de la société que je représente et dont les PDL/PCE (points de livraison/points comptage estimation) sont les suivants :", justify))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("PDL :", normal))
    for value in [p.strip() for p in clean(data.get("pdl")).split(",") if p.strip()]:
        story.append(Paragraph(f"<b>{value}</b>", bold_p))
    story.append(Paragraph("&nbsp;&nbsp;&nbsp; -  ……………………………………………………………………….", normal))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("PCE :", normal))
    for value in [p.strip() for p in clean(data.get("pce")).split(",") if p.strip()]:
        story.append(Paragraph(f"<b>{value}</b>", bold_p))
    for _ in range(2):
        story.append(Paragraph("&nbsp;&nbsp;&nbsp; -  ……………………………………………………………………….", normal))
    story.append(Spacer(1, 7 * mm))
    story.append(Paragraph("En vue de la préparation d'une offre de fourniture de gaz et/ou d'électricité.", normal))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("La présente autorisation est conclue pour une durée de douze (12) mois à compter de sa signature.", normal))
    story.append(Spacer(1, 10 * mm))
    fait_a = clean(data.get("fait_a"))
    date_v = clean(data.get("date_signature"))
    tbl = Table([[Paragraph(f"Fait à {fait_a}" if fait_a else "Fait à", normal), Paragraph(f"le {date_v}" if date_v else "le", normal)]], colWidths=[content_w * 0.5, content_w * 0.5])
    tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.extend([tbl, Spacer(1, 4 * mm), Paragraph("Signature :", normal)])

    def footer(canvas, _doc):
        canvas.saveState()
        fy = 12 * mm
        canvas.setStrokeColor(colors.HexColor("#cccccc"))
        canvas.setLineWidth(0.5)
        canvas.line(ml, fy + 11 * mm, ml + content_w, fy + 11 * mm)
        logo_w = 32 * mm
        logo_h = 17 * mm
        canvas.drawImage(io.BytesIO(logo_bytes), ml, fy - 3 * mm, width=logo_w, height=logo_h, preserveAspectRatio=True, mask="auto")
        sep_x = ml + logo_w + 4 * mm
        canvas.line(sep_x, fy, sep_x, fy + 9 * mm)
        tx = sep_x + 4 * mm
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(colors.HexColor("#222222"))
        canvas.drawString(tx, fy + 4.5 * mm, "Hello Energy SAS")
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(tx, fy + 1 * mm, "20 impasse d'Agen - 33800 Bordeaux, France  •  SIRET : 939 973 713 00014")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        secret = os.environ.get("FORM_WEBHOOK_SECRET", "")
        given = self.headers.get("x-capella-internal-secret", "")
        if not secret or given != secret:
            self.send_response(401)
            self.end_headers()
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            data = json.loads(self.rfile.read(length) or b"{}")
            required = ["nom_prenom", "nom_societe", "siret", "mail", "telephone"]
            missing = [k for k in required if not clean(data.get(k))]
            if missing:
                raise ValueError("Champs manquants: " + ", ".join(missing))
            pdf = build_pdf(data)
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Length", str(len(pdf)))
            self.end_headers()
            self.wfile.write(pdf)
        except Exception as exc:
            body = json.dumps({"error": str(exc)}).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
