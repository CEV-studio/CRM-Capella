// Capella Energy — Google Sheet -> CRM
// À coller dans Extensions > Apps Script du Sheet de réponses.
// Créer ensuite un déclencheur installable `onFormSubmit` sur événement "À l'envoi du formulaire".

const CRM_WEBHOOK_URL = 'https://crm.capellaenergy.fr/api/integrations/google-form';

function onFormSubmit(e) {
  const row = e.range.getRow();
  const sheet = e.range.getSheet();
  const values = e.namedValues || {};

  const first = (name) => {
    const v = values[name];
    return Array.isArray(v) ? (v[0] || '') : (v || '');
  };

  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('CAPELLA_FORM_WEBHOOK_SECRET');
  if (!secret) throw new Error('CAPELLA_FORM_WEBHOOK_SECRET manquant dans les propriétés du script.');

  const payload = {
    external_id: `${SpreadsheetApp.getActive().getId()}:${sheet.getSheetId()}:${row}`,
    horodateur: first('Horodateur'),
    vendeur: first('Vendeur'),
    nom_entreprise: first('Nom entreprise (en majuscule sans accents)'),
    siret: first('SIRET'),
    adresse_consommation: first('Adresse consommation'),
    nom_dirigeant: first('Nom dirigeant'),
    prenom_dirigeant: first('Prénom dirigeant'),
    telephone_decisionnaire: first('Téléphone décisionnaire (portable uniquement)'),
    mail_decisionnaire: first('Mail décisionnaire'),
    energie: first('Énergie'),
    echeance_contrat: first('Échéance contrat'),
    numero_compteur: first('N° de compteur'),
    accord_collecte: first('Accord de collecte de données'),
    facture_client: first('Facture client'),
    date_r2: first("Date du R2 (présentation de l'offre)"),
    commentaires: first('Commentaires (concurrence ou non, durée du contrat souhaité, marge souhaitée,...)')
  };

  const response = UrlFetchApp.fetch(CRM_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-capella-form-secret': secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`CRM ${code}: ${response.getContentText()}`);
  }
}
