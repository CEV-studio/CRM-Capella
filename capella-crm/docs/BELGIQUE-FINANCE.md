# Commissions, clawbacks et bonus énergie MEGA

## États financiers
La production sans appel officiel reste prévisionnelle. La production du mois M donne lieu à un appel le 15 de M+1. L'appel officiel valide les montants ; il ne prouve ni transmission de facture ni encaissement.

La facturation de septembre 2026 à MEGA a été explicitement confirmée par l'utilisateur le 20 octobre. Sa date et sa référence de facture restent non renseignées, de même que l'encaissement. Les pièces centre déjà établies ne sont pas marquées émises ou payées.

Le tableau sépare prévisionnel, validé, facturé et encaissements confirmés. Le facturé est une partie du validé : ils ne s'additionnent pas. Les régularisations et bonus de fidélité sont suivis séparément. Un filtre centre ne ventile pas artificiellement l'encaissement global fournisseur.

## Clawback
Un contrat dans ses trois premiers mois n'est pas un clawback. Il faut une commission positive dans un appel officiel, une résiliation et une durée inférieure à trois mois confirmée par les dates.

Reprise = commission initialement rémunérée × (3 − mois entiers accomplis) / 3, arrondie au centime. Les bases centre et MEGA sont distinctes. Sur 30 € centre et deux mois accomplis, la reprise est 10 €. Au terme de trois mois, la reprise est nulle. Les récupérations déjà effectuées sont déduites du restant dû. Ces montants calculés sont à rapprocher de la régularisation du fournisseur.

Sans dates confirmées, le dossier est « à vérifier », sans montant supposé. Un appel à zéro ne constitue pas une commission antérieure à récupérer. Le filtre mensuel/annuel des reprises utilise la date de résiliation, pas l'inscription.

## Bonus Capella
Après trois mois complets, Capella gagne 10 € par EAN, intégralement pour Capella. Électricité + gaz peuvent représenter 20 €.

États distincts : potentiel non acquis, acquis à facturer, facturé en attente de paiement, encaissé. Une date d'effet observée n'acquiert pas le bonus. Il faut un effet confirmé et un reporting attestant que le contrat est encore actif au terme du cycle, une résiliation confirmée postérieure au cycle, ou une confirmation explicite de cycle accompli.

Le filtre des bonus utilise le mois de fin du cycle. Les bonus sans date restent visibles au global. Les montants potentiels ne sont pas ajoutés au chiffre d'affaires acquis.

## Écrans et conservation
Le tableau met en avant effectifs, salle d'attente, validation client, clawbacks et bonus. Les annulations et autres statuts restent dans le registre et dans un détail replié, sans KPI principal.

Dans « Clawbacks & bonus », renseigner les dates et montants confirmés. Ces confirmations sont stockées dans be_cycle_tracking, séparément des imports, qui ne peuvent pas les effacer. Le suivi fournisseur utilise be_supplier_billing. Ces deux tables sont réservées aux administrateurs actifs par RLS.

Les Google Sheets restent conservés sans modification ni synchronisation automatique. Les règles concernent ici l'énergie MEGA ; aucune règle télécom n'est présumée.

## Vérification
Les tests tests/belgium-finance.mjs sont exécutés avant chaque build. Ils couvrent 0/1/2/3 mois, les proratas, les paiements partiels, les dates manquantes, les reportings anciens, les quatre états de bonus, les périodes mensuelles et le 15 de M+1.
