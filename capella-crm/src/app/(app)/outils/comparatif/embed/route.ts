import { requireProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

function esc(value: string | null) {
  return (value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function GET(request: Request) {
  await requireProfile();
  const url = new URL(request.url);
  const q = url.searchParams;
  const company = esc(q.get("company"));
  const firstName = esc(q.get("firstName"));
  const lastName = esc(q.get("lastName"));
  const pdl = esc(q.get("pdl"));
  const energy = q.get("energy") === "gas" ? "gas" : "electricity";
  const car = Number(q.get("car") || 0);
  const optionRaw = (q.get("option") || "").toLowerCase();

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>TABGen — Capella Energy</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/CEV-studio/Tabgen@main/TABGen/style.css"></head><body>
<header class="app-header"><div class="header-inner"><div class="header-brand"><div class="brand-text"><span class="brand-name">TABGen</span><span class="brand-by">Capella Energy</span></div></div><div class="header-title"><h1>Générateur de Compte Rendu de Consultation</h1><p>Comparez les offres fournisseurs et générez un PDF professionnel</p></div></div></header>
<main class="app-main">
<section class="form-section"><div class="section-header"><span class="section-num">01</span><div><h2>Informations client</h2><p>Données générales de la consultation</p></div></div><div class="section-body"><div class="grid-2"><div class="form-group"><label for="firstName">Prénom du contact</label><input type="text" id="firstName"></div><div class="form-group"><label for="lastName">Nom du contact</label><input type="text" id="lastName"></div><div class="form-group"><label for="company">Nom de la société</label><input type="text" id="company"></div><div class="form-group"><label for="pdl">Point de livraison</label><input type="text" id="pdl"></div><div class="form-group"><label for="yearsCount">Durée d'analyse des économies</label><select id="yearsCount"><option value="1">1 an</option><option value="2">2 ans</option><option value="3" selected>3 ans</option><option value="4">4 ans</option><option value="5">5 ans</option></select></div><div class="form-group"><label for="studyDate">Date de l'étude</label><input type="text" id="studyDate"></div><div class="form-group"><label for="validUntil">Validité de la proposition</label><input type="text" id="validUntil"></div></div><div class="form-group mt-20"><label>Type d'énergie</label><div class="energy-selector"><button type="button" class="energy-btn active" data-energy="electricity" onclick="setEnergy('electricity')"><span class="energy-icon">⚡</span><span class="energy-label">Électricité</span></button><button type="button" class="energy-btn" data-energy="gas" onclick="setEnergy('gas')"><span class="energy-icon">🔥</span><span class="energy-label">Gaz</span></button></div></div><div class="form-group mt-20" id="tariff-section"><label>Option tarifaire</label><div class="tariff-options" id="tariff-options"></div></div><div class="form-group mt-20" id="bands-section" style="display:none"><label>Postes tarifaires actifs</label><div id="bands-container"></div></div></div></section>
<section class="form-section"><div class="section-header"><span class="section-num">02</span><div><h2>Volumes de consommation</h2><p>Consommations annuelles en MWh</p></div></div><div class="section-body"><div id="volumes-container"></div></div></section>
<section class="form-section"><div class="section-header"><span class="section-num">03</span><div><h2>Offres fournisseurs</h2><p>Saisissez les prix de chaque offre pour obtenir le comparatif</p></div></div><div class="section-body"><div class="offers-toolbar"><button type="button" id="add-offer-btn" class="btn-secondary" onclick="addOffer()">+ Ajouter une offre</button><span id="offers-count" class="offers-count"></span></div><div class="offers-scroll"><div id="offers-container" class="offers-grid"></div></div></div></section>
<div class="actions-bar"><button type="button" class="btn-ghost" onclick="resetForm()">↺ Réinitialiser</button><button type="button" class="btn-generate" id="generate-btn" onclick="generatePDF()"><span>📄</span> Générer le PDF</button></div><div id="success-msg" class="success-msg hidden">✓ PDF généré avec succès !</div></main>
<div id="spinner-overlay" class="spinner-overlay hidden"><div class="spinner-box"><div class="spinner"></div><p>Génération du PDF en cours…</p></div></div><canvas id="chart-canvas" width="760" height="380" style="position:fixed;left:-9999px;top:-9999px;display:block"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script><script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script><script>if(window.pdfjsLib){pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}</script><script src="https://cdn.jsdelivr.net/gh/CEV-studio/Tabgen@main/TABGen/generator.js"></script>
<script>
(function(){
  const memory = Object.create(null);
  function remember(){
    document.querySelectorAll('input[id],select[id],textarea[id]').forEach(function(el){
      if(el.type==='file') return;
      memory[el.id] = el.type==='checkbox' || el.type==='radio' ? { checked: el.checked } : { value: el.value };
    });
  }
  function restore(){
    document.querySelectorAll('input[id],select[id],textarea[id]').forEach(function(el){
      const saved = memory[el.id];
      if(!saved) return;
      if(Object.prototype.hasOwnProperty.call(saved,'checked')) el.checked = saved.checked;
      if(Object.prototype.hasOwnProperty.call(saved,'value')) el.value = saved.value;
    });
    if(typeof updateAllTotals==='function') updateAllTotals();
    if(typeof onVolumeChange==='function') onVolumeChange();
  }
  function wrap(name){
    const original = window[name];
    if(typeof original!=='function') return;
    window[name] = function(){
      remember();
      const result = original.apply(this, arguments);
      restore();
      return result;
    };
  }
  ['setEnergy','setOption','onBandChange','addOffer','removeOffer'].forEach(wrap);
  document.addEventListener('input', function(e){ const el=e.target; if(el && el.id) remember(); }, true);
  document.addEventListener('change', function(e){ const el=e.target; if(el && el.id) remember(); }, true);
  window.__tabgenRemember = remember;
  window.__tabgenRestore = restore;
})();

document.addEventListener('DOMContentLoaded',function(){
  const set=(id,v)=>{const el=document.getElementById(id);if(el&&v)el.value=v};
  set('company','${company}');set('firstName','${firstName}');set('lastName','${lastName}');set('pdl','${pdl}');
  if(typeof setEnergy==='function')setEnergy('${energy}');
  let opt='';const raw='${esc(optionRaw)}';
  if(raw.includes('base'))opt='c5base';else if(raw.includes('hp')||raw.includes('hc'))opt='c5hphc';else if(raw.includes('c4'))opt='c4';else if(raw.includes('c3'))opt='c3';else if(raw.includes('c2'))opt='c2';else if(raw.includes('c1'))opt='c1';
  if(opt&&typeof setOption==='function')setOption(opt);
  const vol=document.getElementById('vol_total');
  if(vol&&${Number.isFinite(car) ? car : 0}>0){vol.value=String(${Number.isFinite(car) ? car : 0}/1000);if(typeof onVolumeChange==='function')onVolumeChange()}
  if(typeof window.__tabgenRemember==='function')window.__tabgenRemember();
});
</script></body></html>`;

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
