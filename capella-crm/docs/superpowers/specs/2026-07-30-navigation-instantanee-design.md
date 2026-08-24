# Navigation instantanée — conception

## Objectif

Supprimer l'impression d'écran blanc lors du passage entre les écrans protégés du CRM, sans mettre en cache les données métier ni modifier les règles RLS.

## Conception retenue

Une frontière de chargement Next.js est ajoutée au groupe d'écrans connectés. Pendant qu'une page dynamique récupère ses données, la barre latérale reste visible et une maquette légère reprenant la structure d'un tableau de bord s'affiche immédiatement. Elle est remplacée automatiquement par la page réelle dès que la requête sécurisée est terminée.

## Contraintes

- Aucun changement de base, d'authentification ou de politique RLS.
- Aucun cache persistant de prospects ou d'affaires dans le navigateur.
- Aucune dépendance supplémentaire.
- Le chargement doit être discret, accessible et cohérent avec la charte Capella.

## Vérification

Un contrôle automatisé vérifie l'existence de la frontière de chargement et ses éléments d'accessibilité ; lint et build Next.js valident ensuite la version de production.
