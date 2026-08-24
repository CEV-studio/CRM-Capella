# Mettre le CRM en ligne — guide clic par clic

Objectif : que ton équipe accède au CRM depuis n'importe quel navigateur,
avec une adresse du type `capella-crm.vercel.app`, au lieu de tourner
uniquement sur ton Mac.

Compte **30 minutes**. Tu n'as rien à coder.

---

## Ce qu'on utilise, et pourquoi cette méthode

On déploie sur **Vercel** (gratuit pour démarrer). Ta base Supabase, elle, ne
bouge pas : l'application en ligne se connectera à la même base que celle sur
ton Mac. Tes données sont déjà là.

> ⚠️ **Important — on n'envoie en ligne QUE le dossier `capella-crm`.**
> Le reste de ton dossier `Jeremy_Brain` contient des fichiers de prospection
> avec des données personnelles (les CSV de coiffeurs). Ils ne doivent jamais
> partir sur un serveur public. La méthode ci-dessous n'envoie que le CRM,
> rien d'autre.

---

## Étape A — Créer ton compte Vercel (5 min)

1. Va sur **https://vercel.com** → **Sign Up**.
2. Choisis **Continue with Email** (ou GitHub si tu en as un, mais l'email
   suffit).
3. Utilise `jeremy@capellaenergy.fr`.
4. Quand il demande « Hobby or Pro » : choisis **Hobby** (gratuit).

C'est tout pour l'instant. On revient sur le site plus tard.

---

## Étape B — Installer l'outil Vercel sur ton Mac (3 min)

Dans le Terminal, colle :

```bash
npm install -g vercel
```

Puis connecte-toi :

```bash
vercel login
```

Il te demande ton email, t'envoie un lien de confirmation. Ouvre ton mail,
clique le lien, reviens au Terminal : il affiche « Congratulations ». Bon.

---

## Étape C — Premier envoi (5 min)

Place-toi dans le dossier du CRM et lance le déploiement :

```bash
cd /Users/choisnard/Jeremy_Brain/capella-crm && vercel
```

Il pose quelques questions. Réponds simplement :

| Question | Ta réponse |
|----------|------------|
| Set up and deploy? | tape **Entrée** (oui) |
| Which scope? | ton compte, **Entrée** |
| Link to existing project? | **N** (non) |
| Project's name? | **capella-crm**, Entrée |
| In which directory is your code? | **./** puis Entrée |
| Modify settings? | **N** (non) |

Il construit et met en ligne. À la fin, il affiche une adresse
(`https://capella-crm-xxxx.vercel.app`). **Ne t'emballe pas** : cette première
version ne marche pas encore, il lui manque les clés. On les ajoute à l'étape D.

---

## Étape D — Donner les clés à la version en ligne (7 min)

La version en ligne a besoin des **mêmes trois clés** que ton `.env.local`.
On les colle dans Vercel.

1. Va sur **https://vercel.com/dashboard**.
2. Clique sur ton projet **capella-crm**.
3. En haut → onglet **Settings** → menu de gauche **Environment Variables**.
4. Ajoute les **trois** variables, une par une. Pour chacune : nom à gauche,
   valeur à droite, laisse les trois environnements cochés (Production,
   Preview, Development), puis **Save**.

Les valeurs sont **exactement celles de ton fichier `.env.local`**. Pour le
rouvrir :

```bash
open -e /Users/choisnard/Jeremy_Brain/capella-crm/.env.local
```

| Nom (à copier tel quel) | Valeur |
|-------------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ton adresse `https://….supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ta clé publique |
| `SUPABASE_SERVICE_ROLE_KEY` | ta clé secrète |

> 🔒 La clé secrète est aussi puissante que le mot de passe maître. Ne la colle
> que dans Vercel (ici) et dans ton `.env.local`. Jamais ailleurs.

---

## Étape E — Remettre en ligne, pour de bon (3 min)

Maintenant que les clés sont là, on relance un déploiement qui les prendra en
compte :

```bash
cd /Users/choisnard/Jeremy_Brain/capella-crm && vercel --prod
```

À la fin, il affiche l'adresse **de production**. Ouvre-la dans ton navigateur.
Tu dois voir l'écran de connexion Capella. Connecte-toi avec ton compte admin.

**Si tu vois ton tableau de bord : c'est en ligne. 🎉**

---

## Étape F — Prévenir Supabase de la nouvelle adresse (2 min)

Pour que la connexion soit parfaitement propre, indique à Supabase l'adresse
de ton CRM en ligne.

1. Dans **Supabase** → ton projet → **Authentication** → **URL Configuration**.
2. Dans **Site URL**, colle ton adresse Vercel de production
   (`https://capella-crm-xxxx.vercel.app`).
3. **Save**.

---

## À partir de maintenant

- **Ton équipe se connecte** à l'adresse Vercel de production, avec les
  identifiants que tu leur as créés. Plus besoin de ton Mac allumé.
- **Chaque fois que je fais une amélioration**, tu la mets en ligne avec une
  seule commande :

```bash
cd /Users/choisnard/Jeremy_Brain/capella-crm && vercel --prod
```

- **L'adresse `.vercel.app` te va ?** Si tu veux une adresse à ton nom
  (`crm.capellaenergy.fr`), c'est possible : dis-le-moi, ça se règle dans
  Vercel → Settings → Domains, et je te guide.

---

## Si quelque chose coince

- **« command not found: vercel »** après l'installation → ferme et rouvre le
  Terminal, réessaie.
- **La page en ligne affiche une erreur** → le plus souvent une clé manquante
  ou mal collée (espace en trop). Reprends l'étape D, vérifie les trois
  valeurs, puis relance l'étape E.
- **Autre chose** → envoie-moi une capture de l'écran ou le message du
  Terminal, je corrige.
