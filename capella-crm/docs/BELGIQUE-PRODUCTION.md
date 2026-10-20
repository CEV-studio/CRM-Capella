# Production belge

Le menu **Belgique → Production & facturation** ouvre `/belgique`. Il est réservé aux administrateurs actifs, à la fois dans les pages et dans les politiques RLS. Les profils centres ne sont pas encore activés.

## Transition depuis Google Sheets

Les Sheets central, TILIRA et Cimsourse restent accessibles via les liens du module. Aucune synchronisation ni écriture Google n'est effectuée. Les reportings continuent donc à être intégrés séparément dans les Sheets pendant la transition.

La reprise initiale contient 356 lignes du registre au 20 octobre 2026, les 24 lignes de l'appel MEGA de septembre (dont 3 à zéro), ainsi que la pièce TILIRA AF-TILIRA-MEGA-2026-001 de 695 €. L'état « Établie » n'atteste ni transmission ni paiement. Les statuts historiques antérieurs à cette reprise ne sont pas reconstitués.

## Import

Dans **Imports**, déposer le reporting MEGA CSV, TSV ou XLSX. Indiquer la date du reporting, lire l'aperçu puis confirmer. L'import est atomique : une ligne invalide annule le lot entier. Les fichiers identiques et les reportings plus anciens sont refusés. Les EAN numériques Excel sont refusés pour éviter de conserver un identifiant arrondi ; exporter ces cellules en texte.

La clé comprend fournisseur, ID MEGA, EAN et énergie. Une inscription incomplète sans EAN est identifiée par ID et énergie ; son activation est rapprochée sans créer un second contrat. Le registre source comporte une anomalie où le même ID/EAN est utilisé pour deux énergies en erreur : ces lignes sont conservées séparément et signalées. Houssam Terazi est toujours rattaché à Cimsourse.

Les dates d'effet et de fin de clawback reprises du central sont observées, donc provisoires. Pour un nouveau contrat effectif sans date fournisseur, la première date de reporting fait office de date observée. Un reporting suivant ne décale pas cette date.

## Calculs

Le tableau financier ne compte que les contrats actuellement effectifs. Un appel officiel donne le mois de commissionnement et les montants prioritaires ; à défaut, la période est provisoire et vient de l'effet observé. La production mensuelle des inscriptions utilise un bloc distinct. Les attentes globales ne sont donc pas confondues avec des commissions du mois.

Prévision résidentielle MEGA : 65 € par énergie, 10 € de domiciliation complète ; centre 30 € + 5 €. Une domiciliation partielle n'ajoute pas de bonus prévisionnel. Un appel officiel peut confirmer son bonus. Les bonus de fidélité de 10 € à la sortie du clawback ne sont pas anticipés. La marge Capella est avant charges. Les dates estimées de fin de clawback ne prouvent pas une validation du fournisseur.

L'import métier et les barèmes de cette version concernent MEGA résidentiel. Les appels ENGIE, le B2B et la téléphonie nécessitent un barème et un adaptateur spécifiques ; ne pas utiliser le format MEGA pour ces produits.

## Facturation

Importer l'appel officiel MEGA dans **Imports**, type « Appel officiel », avec sa période. Les lignes et montants confirmés sont conservés séparément des statuts quotidiens. Les lignes annulées/résiliées à zéro restent visibles.

Dans **Facturation**, sélectionner le centre, la période et une référence unique. Le document contient un instantané des lignes de l'appel officiel ; un reporting ultérieur ne réécrit pas ce montant. Le PDF généré est un **appel à facturation détaillé**, pas une facture fiscale d'autofacturation. Les factures fiscales existantes ne sont pas réémises automatiquement. Une pièce unique est autorisée par fournisseur, centre et mois.

« Établie », « Émise » et « Payée » sont séparés. Les dates de transmission et de règlement sont à saisir uniquement à partir des confirmations. Aucun paiement n'est supposé à l'import. Les régularisations financières et l'émission de factures fiscales restent à gérer séparément dans cette version.

## Vérification

- `npm run test:belgium` : clés dual, EAN non arrondis, reprise d'inscriptions incomplètes, périodes, fins de mois, atomicité, rejouabilité, historique, pièces figées, états de paiement et isolation des accès.
- `npm run test:partners` : non-régression du portail apporteurs.
- `npm run build` et `npx tsc --noEmit`.

La migration crée cinq tables `be_*` et deux fonctions RPC en mode SECURITY INVOKER. Elle ne modifie aucune donnée du courtage français.

## Tableau de bord graphique

Les vues Global / Année / Mois filtrent les cartes et le graphique de statuts par **date d’inscription**. Il s’agit du statut actuel de cette cohorte, pas d’un historique des transitions. Les cartes ouvrent le registre avec les mêmes filtres. Le repère annuel représente les douze mois de l’année sélectionnée, y compris les mois sans inscriptions.

Le bandeau financier utilise séparément la **période de commissionnement**, confirmée par l’appel officiel ou provisoire à défaut. Les contrats inscrits en septembre mais commissionnés en octobre sont donc dans les statuts de septembre et les montants d’octobre. Ces deux bases sont indiquées explicitement.

Les liens Sheets sont regroupés dans « Mes sauvegardes Google Sheets », réservé comme tout le module à l’administrateur. Le changement ne modifie ni les fichiers, ni leur partage, ni leur synchronisation.
