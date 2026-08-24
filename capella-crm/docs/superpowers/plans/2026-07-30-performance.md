# Optimisation de performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diminuer les temps de navigation et d'action sans réduire la sécurité ou les fonctionnalités du CRM.

**Architecture:** Le proxy ne fera plus d'appel réseau d'identité à chaque route. Les pages continueront à appeler `requireProfile`, dont le résultat est dédupliqué par requête. Les listes liront des projections réduites et les index SQL supporteront les filtres courants.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres/RLS, Supabase Auth.

## Global Constraints

- Conserver Next.js + Supabase + RLS sans alternative technologique.
- Ne jamais utiliser la clé de service pour une action métier utilisateur.
- Conserver tous les tests d'isolation RLS au vert.

---

### Task 1: Mesurer et alléger le garde de session

**Files:**
- Modify: `src/proxy.ts`
- Test: mesures HTTP et navigateur avant/après.

- [ ] Remplacer `supabase.auth.getUser()` du proxy par la récupération locale de session, sans toucher aux redirections.
- [ ] Vérifier qu'une requête anonyme est toujours redirigée vers `/connexion`.
- [ ] Vérifier qu'une page connectée appelle toujours `requireProfile` et que RLS reste la source d'autorité.

### Task 2: Projections et index des listes

**Files:**
- Create: `supabase/migrations/0006_performance.sql`
- Modify: `src/app/(app)/prospection/page.tsx`
- Modify: `src/app/(app)/conversion/page.tsx`

- [ ] Définir les colonnes visibles par liste et remplacer les `select("*")` correspondants.
- [ ] Ajouter des index partiels sur les prospects et affaires non supprimés, filtrés/tris par propriétaire, étape, source et dates.
- [ ] Vérifier `EXPLAIN` sur les requêtes représentatives localement.

### Task 3: Cache des référentiels et navigation fluide

**Files:**
- Modify: `src/lib/domain/*` ou créer `src/lib/referentiels.ts`
- Modify: écrans consommant étapes, sources, fournisseurs, apporteurs.
- Modify: composants de navigation et actions de changement d'étape.

- [ ] Mettre en cache les référentiels avec une durée courte et invalidation après modification.
- [ ] Précharger les liens principaux de navigation.
- [ ] Ajouter une mise à jour optimiste pour les changements d'étape, avec restauration explicite en cas d'échec.

### Task 4: Vérification et livraison

**Files:**
- Modify: `GUIDE-JEREMY.md`
- Test: `supabase/tests/rls_isolation.sql`, `npm run build`, parcours navigateur.

- [ ] Rejouer la suite RLS complète.
- [ ] Comparer les requêtes et les temps avant/après sur les trois parcours de référence.
- [ ] Ajouter l'étape SQL `0006` et la procédure de déploiement au guide.
