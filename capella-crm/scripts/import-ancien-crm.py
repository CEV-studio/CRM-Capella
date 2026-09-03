#!/usr/bin/env python3
"""Import historique CRM Capella depuis le classeur Excel d'origine.

Par défaut: dry-run, aucune écriture.
Apply: python3 scripts/import-ancien-crm.py /chemin/CRM.xlsx --apply

Le script n'utilise que la bibliothèque standard Python. Il lit .env.local pour
NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.
"""
from __future__ import annotations
import argparse, datetime as dt, json, os, re, sys, urllib.parse, urllib.request, zipfile
import xml.etree.ElementTree as ET
from collections import Counter

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PROSPECT_SHEETS = ["PROSPECTION", "Rappels", "Demande de facture", "Demande ACD", "DFF trop éloigné", "KO", "Pas intéressé", "Numéro KO", "À TRANSFÉRER"]
VALID_STAGES = {"NRP", "Rappels", "Demande de facture", "Demande ACD", "RDV comparatif", "Présentation", "RIB", "DFF trop éloigné", "KO", "Numéro KO", "Pas intéressé"}


def load_env(path=".env.local"):
    if not os.path.exists(path): return
    for line in open(path, encoding="utf-8"):
        line=line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k,v=line.split("=",1); os.environ.setdefault(k.strip(),v.strip())


def digits(v): return re.sub(r"\D", "", str(v or "")) or None

def clean(v):
    s=str(v or "").strip()
    return s or None


def excel_date(v):
    if v in (None, ""): return None
    s=str(v).strip()
    try:
        n=float(s)
        if 20000 < n < 80000:
            return (dt.datetime(1899,12,30)+dt.timedelta(days=n)).date().isoformat()
    except ValueError: pass
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
        try: return dt.datetime.strptime(s[:10],fmt).date().isoformat()
        except ValueError: pass
    if re.fullmatch(r"20\d{2}",s): return f"{s}-12-31"
    return None


def split_name(v):
    s=clean(v)
    if not s: return (None,None)
    p=s.split()
    if len(p)==1: return (p[0],None)
    return (" ".join(p[1:]), p[0])  # nom, prénom ; valeur brute conservée dans legacy_payload


def colnum(ref):
    n=0
    for ch in re.match(r"[A-Z]+",ref).group(0): n=n*26+ord(ch)-64
    return n


class Xlsx:
    def __init__(self,path):
        self.z=zipfile.ZipFile(path)
        self.shared=[]
        if "xl/sharedStrings.xml" in self.z.namelist():
            root=ET.fromstring(self.z.read("xl/sharedStrings.xml"))
            for si in root:
                self.shared.append("".join((t.text or "") for t in si.iter(f"{{{NS}}}t")))
        wb=ET.fromstring(self.z.read("xl/workbook.xml"))
        rels=ET.fromstring(self.z.read("xl/_rels/workbook.xml.rels"))
        rmap={r.attrib["Id"]:r.attrib["Target"] for r in rels}
        self.sheets={}
        for s in wb.find(f"{{{NS}}}sheets"):
            self.sheets[s.attrib["name"]]=rmap[s.attrib[f"{{{RNS}}}id"]]

    def _value(self,c):
        typ=c.attrib.get("t")
        v=c.find(f"{{{NS}}}v")
        if v is None:
            isel=c.find(f"{{{NS}}}is")
            return "".join((t.text or "") for t in isel.iter(f"{{{NS}}}t")) if isel is not None else None
        raw=v.text
        if typ=="s":
            try:return self.shared[int(raw)]
            except:return raw
        return raw

    def rows(self,name):
        root=ET.fromstring(self.z.read("xl/"+self.sheets[name]))
        data=root.find(f"{{{NS}}}sheetData")
        for row in data:
            vals={colnum(c.attrib["r"]):self._value(c) for c in row}
            yield int(row.attrib.get("r","0")), vals


class Supabase:
    def __init__(self,url,key): self.url=url.rstrip("/"); self.key=key
    def req(self,method,table,body=None,query="",prefer="return=representation"):
        u=f"{self.url}/rest/v1/{table}{query}"
        data=json.dumps(body).encode() if body is not None else None
        headers={"apikey":self.key,"Authorization":f"Bearer {self.key}","Content-Type":"application/json","Prefer":prefer}
        r=urllib.request.Request(u,data=data,headers=headers,method=method)
        try:
            with urllib.request.urlopen(r) as res:
                raw=res.read().decode(); return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Supabase {e.code} {table}: {e.read().decode()}")

    def source_id(self,name):
        q="?select=id&name=eq."+urllib.parse.quote(name,safe="")
        got=self.req("GET","sources",query=q)
        if got:return got[0]["id"]
        created=self.req("POST","sources",{"name":name,"kind":"autre"})
        return created[0]["id"]

    def profile_map(self):
        rows=self.req("GET","profiles",query="?select=id,full_name") or []
        return {r["full_name"].strip().lower():r["id"] for r in rows}


def prospect_from(sheet,rownum,v):
    nom,prenom=split_name(v.get(2))
    legacy_stage=clean(v.get(6)) or (sheet if sheet!="PROSPECTION" else "NRP")
    stage=legacy_stage if legacy_stage in VALID_STAGES else "NRP"
    dff=excel_date(v.get(19))
    notes=clean(v.get(5))
    if stage=="DFF trop éloigné" and not dff:
        stage="Rappels"
        notes=((notes+"\n") if notes else "")+f"[Historique: DFF trop éloigné — date brute: {clean(v.get(19)) or 'vide'}]"
    oldref=clean(v.get(1))
    if not oldref or oldref=="#ERROR!": oldref=f"{sheet}:{rownum}"
    return {
        "legacy_ref":oldref,"legacy_sheet":sheet,"legacy_stage":legacy_stage,
        "legacy_payload":{"row":rownum,"nom_prenom":clean(v.get(2)),"puissance":clean(v.get(11)),"date_fin_contrat_brute":clean(v.get(19))},
        "nom":nom,"prenom":prenom,"mail":clean(v.get(3)),"tel_mobile":clean(v.get(4)),"notes":notes,
        "stage":stage,"next_action":clean(v.get(7)),"tel_fixe":clean(v.get(8)),"raison_sociale":clean(v.get(9)),
        "siren":digits(v.get(10)),"segment":clean(v.get(12)),"score":int(float(v.get(13))) if clean(v.get(13)) else None,
        "option_tarifaire":clean(v.get(14)),"code_postal":clean(v.get(15)),"naf":clean(v.get(16)),
        "nb_sites":int(float(v.get(17))) if clean(v.get(17)) else None,"fournisseur_electricite":clean(v.get(18)),
        "date_fin_contrat":dff,"pdl":clean(v.get(22)),"pce":clean(v.get(23)),"puissance":clean(v.get(11)),
        "_source":clean(v.get(20)) or "Ancien CRM"
    }


def affaire_from(rownum,v,profiles):
    nom,prenom=split_name(v.get(8)); vendeur=(clean(v.get(2)) or "").lower()
    aliases={"januario jimmy":"jimmy januario","jimmy":"jimmy januario"}
    vendeur=aliases.get(vendeur,vendeur)
    commercial=profiles.get(vendeur)
    if not commercial: return None,f"ligne {rownum}: commercial introuvable {clean(v.get(2))}"
    typ=clean(v.get(12)); typ=typ if typ in ("Électricité","Gaz","Élec+Gaz") else None
    return {
        "legacy_ref":clean(v.get(1)) or f"CONVERSION:{rownum}","legacy_payload":{"row":rownum,"raw_nom_prenom":clean(v.get(8))},
        "commercial_id":commercial,"raison_sociale":clean(v.get(4)) or "Sans raison sociale","stage":clean(v.get(5)) or "Demande de cotation",
        "adresse_conso":clean(v.get(6)),"siren":digits(v.get(7)),"nom":nom,"prenom":prenom,"mail":clean(v.get(9)),"telephone":clean(v.get(10)),
        "fournisseur":clean(v.get(11)),"type_energie":typ,"contrat":clean(v.get(13)),"pdl_elec":clean(v.get(14)),"pce_gaz":clean(v.get(15)),
        "date_debut":excel_date(v.get(16)),"date_echeance":excel_date(v.get(17)),"car_mwh":float(v.get(18)) if clean(v.get(18)) else None,
        "date_entree":excel_date(v.get(19)) or dt.date.today().isoformat(),"date_signature":excel_date(v.get(20)),"notes":clean(v.get(26)),
        "date_relance":excel_date(v.get(22)),"commission":float(v.get(23)) if clean(v.get(23)) else 0,"facture":clean(v.get(24)),"acd":clean(v.get(25))
    },None


def chunks(xs,n=250):
    for i in range(0,len(xs),n): yield xs[i:i+n]


def main():
    ap=argparse.ArgumentParser(); ap.add_argument("xlsx"); ap.add_argument("--apply",action="store_true"); ap.add_argument("--report",default="legacy-import-report.json")
    args=ap.parse_args(); x=Xlsx(args.xlsx)
    prospects=[]; counts=Counter(); anomalies=[]
    for sheet in PROSPECT_SHEETS:
        if sheet not in x.sheets: anomalies.append(f"feuille absente: {sheet}"); continue
        for rownum,v in list(x.rows(sheet))[1:]:
            if not any(clean(z) for z in v.values()): continue
            p=prospect_from(sheet,rownum,v); prospects.append(p); counts[sheet]+=1
    report={"mode":"apply" if args.apply else "dry-run","prospects":len(prospects),"par_feuille":dict(counts),"affaires":0,"anomalies":anomalies}

    if not args.apply:
        if "CONVERSION" in x.sheets: report["affaires"]=sum(1 for _,v in list(x.rows("CONVERSION"))[1:] if any(clean(z) for z in v.values()))
        json.dump(report,open(args.report,"w",encoding="utf-8"),ensure_ascii=False,indent=2)
        print(json.dumps(report,ensure_ascii=False,indent=2)); print(f"Rapport: {args.report}"); return

    load_env(); url=os.getenv("NEXT_PUBLIC_SUPABASE_URL"); key=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key: sys.exit("Clés Supabase absentes de .env.local")
    db=Supabase(url,key)
    source_cache={}
    for p in prospects:
        s=p.pop("_source"); source_cache.setdefault(s,db.source_id(s)); p["source_id"]=source_cache[s]
    inserted=0
    for pack in chunks(prospects):
        db.req("POST","prospects",pack,prefer="resolution=ignore-duplicates,return=representation"); inserted+=len(pack); print(f"prospects: {inserted}/{len(prospects)}")

    profiles=db.profile_map(); affaires=[]
    if "CONVERSION" in x.sheets:
        for rownum,v in list(x.rows("CONVERSION"))[1:]:
            if not any(clean(z) for z in v.values()): continue
            a,err=affaire_from(rownum,v,profiles)
            if err: anomalies.append(err)
            else: affaires.append(a)
    for pack in chunks(affaires): db.req("POST","affaires",pack,prefer="resolution=ignore-duplicates,return=representation")
    report.update({"affaires":len(affaires),"anomalies":anomalies,"sources_creees_ou_reutilisees":list(source_cache)})
    json.dump(report,open(args.report,"w",encoding="utf-8"),ensure_ascii=False,indent=2); print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__": main()
