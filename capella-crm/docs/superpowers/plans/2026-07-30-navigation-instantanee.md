# Navigation instantanée Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher immédiatement une transition visuelle lors de la navigation entre les pages protégées du CRM.

**Architecture:** Ajouter une frontière `loading.tsx` au groupe App Router `(app)`. Next.js conservera le layout déjà visible et affichera ce squelette pendant que chaque page dynamique conserve son chargement serveur et ses contrôles RLS habituels.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS.

## Global Constraints

- Ne pas modifier Supabase, Auth ni les politiques RLS.
- Ne pas introduire de bibliothèque ou de cache navigateur de données CRM.
- Employer exclusivement la palette Capella déjà présente dans Tailwind.

---

### Task 1: Frontière de chargement des écrans connectés

**Files:**
- Create: `src/app/(app)/loading.tsx`
- Test: vérification shell ciblée sur ce fichier

**Interfaces:**
- Consumes: le groupe App Router protégé `src/app/(app)`.
- Produces: un composant par défaut affiché par Next.js durant une navigation dynamique.

- [ ] **Step 1: Écrire le contrôle initial en échec**

```bash
test -f 'src/app/(app)/loading.tsx' && rg -q 'aria-label="Chargement de la page"' 'src/app/(app)/loading.tsx'
```

- [ ] **Step 2: Exécuter le contrôle et confirmer l'échec**

Run: `test -f 'src/app/(app)/loading.tsx' && rg -q 'aria-label="Chargement de la page"' 'src/app/(app)/loading.tsx'`

Expected: exit code `1`, car la frontière n'existe pas encore.

- [ ] **Step 3: Ajouter le composant minimal**

```tsx
export default function ChargementApplication() {
  return <main aria-label="Chargement de la page">…</main>;
}
```

- [ ] **Step 4: Exécuter le contrôle et confirmer le succès**

Run: `test -f 'src/app/(app)/loading.tsx' && rg -q 'aria-label="Chargement de la page"' 'src/app/(app)/loading.tsx'`

Expected: exit code `0`.

- [ ] **Step 5: Vérifier la production**

Run: `npm run lint && npm run build`

Expected: exit code `0`.
