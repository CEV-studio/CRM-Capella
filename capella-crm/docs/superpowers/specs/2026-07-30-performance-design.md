# Optimisation de performance — conception

## Objectif

Rendre la navigation, l'affichage des listes et les actions du CRM sensiblement plus rapides, sans modifier la stack Next.js + Supabase, sans affaiblir RLS et sans toucher aux données métier.

## Cause ciblée

Le CRM a peu de données : 76 prospects et deux utilisateurs. Le coût principal n'est donc pas le volume. Les pages protégées cumulent des appels distants d'authentification et plusieurs requêtes serveur ; certaines listes demandent toutes les colonnes et un comptage exact à chaque affichage. Ces allers-retours sont perceptibles sur une base Supabase distante.

## Solution retenue

1. Le proxy conserve uniquement la synchronisation de session Supabase ; l'autorisation applicative reste dans les pages et les actions, et l'isolation reste garantie par RLS PostgreSQL.
2. Les listes chargent uniquement leurs colonnes visibles ; les fiches conservent le chargement complet.
3. Les référentiels peu changeants (étapes, sources, fournisseurs, apporteurs) sont mis en cache avec invalidation explicite sur les écrans qui les modifient.
4. Les requêtes de prospection et de conversion reçoivent des index Postgres adaptés aux filtres et tris réellement utilisés.
5. Les actions courantes passent à une mise à jour optimiste : le résultat est visible immédiatement, suivi d'une confirmation serveur et d'un retour arrière explicite si la base refuse.

## Contraintes de sécurité

- Aucun usage de la clé de service dans les pages métier ou les actions utilisateur.
- RLS continue de décider des lignes et des fichiers visibles.
- Les contrôles de rôle restent effectués avant les actions d'administration.

## Validation

- TypeScript, lint et build Next.js.
- Tests SQL RLS existants.
- Relevé comparatif des temps de réponse sur Prospection, Conversion et un changement d'étape ; le correctif doit réduire les requêtes et non seulement masquer l'attente.
