# Optimisations de lecture CRM — 20 octobre 2026

## Changements

- Échéances : un appel SQL avec filtres, compteurs complets et pagination de 50 lignes. Fin du téléchargement de tous les dossiers et des lectures successives par lots de 200 identifiants.
- Tableau de bord : agrégation des prospects par étape et commercial dans Postgres ; lecture des noms uniquement pour les rendez-vous affichés. Les comptes ne sont plus limités aux 1 000 premières lignes retournées par l'API.
- Réservoir : 100 lignes par page, seulement les 9 colonnes utilisées, filtre kVA conservé entre les pages, totaux par source calculés dans Postgres. Changer de page réinitialise la sélection pour éviter d'attribuer des lignes masquées.
- Prospection : ordre stable par identifiant en complément du tri, filtre explicite sur le propriétaire pour les commerciaux sans droits étendus.
- Cinq index partiels pour les listes et les échéances. Les fonctions sont SECURITY INVOKER, soumises aux politiques RLS et refusées aux comptes anonymes, désactivés et aux apporteurs. Les totaux du réservoir sont réservés aux administrateurs.

## Mesures sur la base réelle

Mesures ponctuelles SQL sous le rôle authenticated, profil administrateur ; elles ne représentent pas le temps de chargement complet du navigateur.

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Tri des 50 prospects récents, EXPLAIN ANALYZE | 7,586 ms | 0,669 ms |
| Parcours de la liste | Scan de 8 463 lignes et tri | Index, 50 lignes |
| JSON des indicateurs de prospection du tableau de bord | 207 031 octets pour 1 000 lignes | 484 octets pour tous les 8 460 prospects non supprimés |

Vérifications réelles : 196 échéances avant et après ; 50 lignes par page ; total du réservoir 7 941 identique au comptage direct. Le commercial testé voit 75 prospects dans les indicateurs, correspondant à ses 75 dossiers, et aucun autre propriétaire.

## Vérifications

- `node tests/crm-read-performance.mjs` : plus de 1 000 prospects, pagination sans chevauchement, frontières 12/18 mois, échéances dépassées, compteurs multiples, archivage, suppression et séparation des rôles.
- `npm run test:partners` : parcours ACD / cotation / ADV et isolation des apporteurs.
- TypeScript et ESLint sur les fichiers modifiés : succès.
- `npm run build` : succès. Avertissement préexistant dans `patchIncorrectLockfile` présent dans l'environnement local, sans échec du build.
- Conseiller sécurité Supabase : aucune nouvelle alerte par rapport à l'état initial.

Les données métier et les règles de commission ne sont pas modifiées. Les résultats sont calculés avec la session courante, sans cache partagé de données clients.
