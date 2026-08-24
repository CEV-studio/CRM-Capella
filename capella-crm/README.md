# Capella CRM

CRM de Capella Energy — prospection et conversion, pour un admin et
un nombre illimité de commerciaux.

**Si tu es Jeremy : lis [GUIDE-JEREMY.md](./GUIDE-JEREMY.md), pas ce fichier.**

## Stack

Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres, Auth, RLS) ·
déploiement Vercel + Supabase cloud.

## Structure

```
supabase/migrations/   0001 schéma · 0002 sécurité RLS · 0003 référentiels
supabase/tests/        rls_isolation.sql — 19 tests d'isolation entre commerciaux
src/lib/supabase/      client navigateur · client serveur · client admin (clé de service)
src/lib/domain/        étapes, couleurs et types — miroir des migrations SQL
src/lib/auth.ts        requireProfile() / requireAdmin()
src/proxy.ts           rafraîchit la session, redirige vers /connexion
```

## Principes

- **La sécurité vit dans Postgres, pas dans l'application.** Les politiques RLS
  de `0002_rls.sql` sont la seule barrière qui compte. Toute nouvelle table
  doit avoir ses politiques *et* un test dans `rls_isolation.sql`.
- **Le client admin (`createAdminClient`) contourne RLS.** Chaque appel doit être
  précédé de `requireAdmin()`.
- **Les libellés d'étapes ne changent jamais** : ce sont ceux du CRM Sheets
  d'origine, connus par cœur des commerciaux. `src/lib/domain/stages.ts` et
  `0003_seed.sql` doivent rester synchronisés.
- **Aucune couleur en dur** hors de `globals.css` et des référentiels d'étapes.

## Commandes

```bash
npm run dev     # développement
npm run build   # vérifie types + build de production
npm run lint
```

## Tester la sécurité

Dans Supabase → SQL Editor, après avoir chargé `supabase/tests/rls_isolation.sql` :

```sql
select * from public.test_rls();
```

Les 19 lignes doivent afficher `ok = true`.
