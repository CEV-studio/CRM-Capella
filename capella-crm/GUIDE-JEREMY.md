# Guide de mise en route — CRM Capella Energy

Ce guide est écrit pour toi, sans jargon. Tu n'as **rien à coder**.
Compte environ **30 minutes** pour cette première étape.

À la fin, tu auras : une base de données en ligne, sécurisée, et
l'application qui s'y connecte sur ton ordinateur.

---

## Ce qu'on installe, en une phrase

Deux services gratuits :

| Service      | À quoi il sert                                    | Coût     |
|--------------|---------------------------------------------------|----------|
| **Supabase** | Le coffre-fort : il stocke toutes tes données     | 0 € pour démarrer |
| **Vercel**   | Le serveur qui affiche l'application aux commerciaux | 0 € pour démarrer |

On s'occupe de Supabase maintenant. Vercel viendra plus tard, quand
l'application sera prête à être partagée à l'équipe.

---

## Étape A — Créer le projet Supabase (10 min)

1. Va sur **https://supabase.com** → bouton **Start your project** (en haut à droite).
2. Connecte-toi avec ton compte Google `jeremy@capellaenergy.fr`.
3. Une fois dedans, clique sur **New project**.
4. Remplis :
   - **Name** : `capella-crm`
   - **Database Password** : clique sur **Generate a password**, puis
     **copie-le et colle-le dans ton gestionnaire de mots de passe**.
     Tu n'en auras quasiment jamais besoin, mais il est irrécupérable si tu le perds.
   - **Region** : choisis **Central EU (Frankfurt)** — le plus proche de la France,
     et tes données restent en Europe (RGPD).
   - **Pricing plan** : laisse **Free**.
5. Clique **Create new project**.
6. Patiente 2 à 3 minutes : Supabase construit ta base. Va faire un café.

---

## Étape B — Installer la structure de la base (5 min)

Ta base est vide. On va y créer les tables (prospects, affaires,
commerciaux, etc.) et surtout les **règles de sécurité**.

Il y a **3 fichiers à exécuter, dans l'ordre**. Ils sont dans le dossier
`capella-crm/supabase/migrations/` :

1. `0001_schema.sql` — les tables
2. `0002_rls.sql` — la sécurité (qui voit quoi)
3. `0003_seed.sql` — les étapes, couleurs et fournisseurs

Pour chacun, dans l'ordre :

1. Dans Supabase, menu de gauche → **SQL Editor** (icône `>_`).
2. Clique **New query**.
3. Ouvre le fichier `.sql` sur ton Mac (clic droit → Ouvrir avec → TextEdit),
   **sélectionne tout** (`Cmd+A`), **copie** (`Cmd+C`).
4. **Colle** dans la fenêtre noire de Supabase (`Cmd+V`).
5. Clique **Run** (ou `Cmd+Entrée`).
6. Tu dois voir **Success. No rows returned** en bas. C'est bon.

> ⚠️ **Si un message rouge apparaît**, ne tente rien : envoie-moi le texte
> exact de l'erreur, je corrige. N'exécute pas le fichier suivant.

**Ne relance jamais `0001` ou `0002` deux fois** : ils créent des choses qui
existeront déjà. `0003` peut être relancé sans risque.

---

## Étape B-bis — Vérifier de tes yeux que le cloisonnement tient (3 min)

C'est la promesse la plus importante du CRM : **un commercial ne peut pas voir
les prospects d'un autre**. Voici comment le constater toi-même, sans me croire
sur parole.

1. **SQL Editor** → **New query**.
2. Colle le contenu du fichier `supabase/tests/rls_isolation.sql` → **Run**.
   (Ça n'installe qu'un outil de test, ça ne change rien à tes données.)
3. **New query** à nouveau, tape simplement :

```sql
select * from public.test_rls();
```

4. **Run**. Un tableau de 19 lignes s'affiche.

Le test crée à la volée une admin, deux commerciales fictives (Alice et Bob),
un compte désactivé, quelques prospects et affaires. Puis il **prend tour à tour
leur identité** et tente exactement ce qu'un commercial mal intentionné tenterait.

**La colonne `ok` doit afficher `true` sur les 19 lignes.** Tu y verras entre autres :

- Alice ne voit que ses 2 prospects (pas ceux de Bob, pas le réservoir)
- Alice ne peut pas voler un lead de Bob
- Alice ne peut pas céder un lead à Bob
- Alice ne peut pas se promouvoir admin ni changer son taux de commission
- Un compte désactivé ne voit plus rien du tout
- Toi (admin) tu vois tout et tu peux réattribuer
- Chaque attribution est tracée dans le journal
- « DFF trop éloigné » est refusé sans date de fin de contrat
- Passer une affaire à « Signé » remplit la date automatiquement

Le test efface ses données fictives en partant : il ne reste rien.
Tu peux le relancer autant de fois que tu veux, y compris plus tard, quand le CRM
sera plein de vraies données — c'est même conseillé après chaque évolution.

> Ces 19 tests ont déjà été exécutés et validés sur une base PostgreSQL de test
> avant de te les donner. Tu les relances pour vérifier sur **ta** base.

---

## Étape C — Récupérer les 3 clés (5 min)

Ce sont les identifiants qui permettent à l'application de parler à ta base.

1. Dans Supabase, en bas à gauche → **Project Settings** (roue dentée).
2. Dans le menu → **API Keys** (ou **API** selon la version).
3. Tu vois trois choses à copier :

| Ce que tu cherches           | Ce que c'est                                  |
|------------------------------|-----------------------------------------------|
| **Project URL**              | l'adresse de ta base                          |
| **anon** / **public**        | la clé publique — sans danger                 |
| **service_role** / **secret**| la clé **SECRÈTE** — donne accès à tout       |

> 🔒 La clé `service_role` est aussi puissante que le mot de passe maître.
> Elle ne doit **jamais** être envoyée par mail, WhatsApp, ni collée ailleurs
> que dans les deux endroits indiqués ci-dessous.

---

## Étape D — Brancher l'application (5 min)

Le fichier qui reçoit tes clés s'appelle `.env.local`. Il est **déjà créé** dans
le dossier `capella-crm`, prêt à remplir.

> 💡 Tu ne le verras pas dans le Finder : sur Mac, tout fichier dont le nom
> commence par un point est masqué. C'est normal, et c'est voulu — c'est le
> fichier qui contient tes secrets. Pour l'ouvrir, passe par le Terminal.

1. Ouvre le Terminal et colle cette ligne :

```bash
open -e /Users/choisnard/Jeremy_Brain/capella-crm/.env.local
```

2. Le fichier s'ouvre dans TextEdit. Colle tes trois valeurs après le signe `=`,
   **sans espace, sans guillemets**, chacune sur sa ligne :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

3. Enregistre avec `Cmd+S`, puis ferme TextEdit.

> Les lignes qui commencent par `#` sont des commentaires : laisse-les, elles
> ne servent qu'à t'expliquer quoi coller où.

---

## Étape E — Vérifier que tout marche (2 min)

Dans le Terminal, tape :

```bash
cd /Users/choisnard/Jeremy_Brain/capella-crm && npm run dev
```

Puis ouvre **http://localhost:3000** dans ton navigateur.

Tu dois voir la page **« État du socle »** avec **4 lignes vertes « OK »** :

- Adresse du projet Supabase
- Clé publique Supabase
- Clé de service
- Base de données joignable — *11 étapes de prospection trouvées*

**Si les 4 lignes sont vertes, l'étape 1 est terminée.** Dis-le-moi,
on enchaîne sur l'étape 2 (connexion et création des comptes commerciaux).

Si une ligne est rouge, le texte gris juste en dessous dit ce qui manque.

---

## Étape 2 — Créer les comptes de ton équipe

Une fois connecté, menu de gauche → **Administration › Commerciaux**.

**Créer un compte** (Aly, Thibault, un call center…) :

1. Nom et prénom, email, taux de commission en %.
2. **Créer le compte**.
3. Un mot de passe provisoire s&apos;affiche dans un cadre vert, du type
   `Capella-ZE4C-2ETU`. Clique **Copier**.
4. Envoie-le par WhatsApp ou SMS à la personne concernée.

> Aucun email n&apos;est envoyé par l&apos;application. C&apos;est toi qui transmets,
> comme convenu. Le mot de passe **n&apos;est affiché qu&apos;une seule fois** :
> si tu le perds, clique « Réinitialiser le mot de passe » et recommence.

À sa première connexion, la personne est **obligée** de choisir son propre mot
de passe : elle ne peut aller nulle part ailleurs tant que ce n&apos;est pas fait.
Tant qu&apos;elle ne l&apos;a pas fait, tu vois l&apos;étiquette jaune
« mot de passe à changer » sur sa ligne.

**Modifier un taux de commission** : change le chiffre, clique **Enregistrer**.

**Désactiver quelqu&apos;un** : bouton **Désactiver**. L&apos;accès est coupé
immédiatement — même si la personne a encore l&apos;application ouverte, elle ne
voit plus rien. Sa ligne devient grise et le bouton devient **Réactiver**.
Rien n&apos;est supprimé : ses prospects et ses affaires restent en base, et tu
pourras les réattribuer à quelqu&apos;un d&apos;autre à l&apos;étape 4.

Tu ne peux pas désactiver ton propre compte : l&apos;application refuse, pour
t&apos;éviter de t&apos;enfermer dehors.

**Ce qu&apos;un commercial voit** : uniquement « Pilotage » dans le menu — pas
d&apos;administration. Et s&apos;il tape l&apos;adresse d&apos;un écran admin à la
main, il est renvoyé sur son tableau de bord. Ces deux comportements ont été
testés en conditions réelles avant livraison.

---

## Étape 3 — La prospection

Menu de gauche → **Prospection**.

**10 prospects de démonstration** ont été mis dans ta base pour que tu puisses
tout essayer sans risque. Ils commencent tous par `DEMO —`. Quand tu en as
assez, supprime-les d'un coup avec cette commande :

```bash
cd /Users/choisnard/Jeremy_Brain/capella-crm && node scripts/donnees-de-test.mjs supprimer
```

**Changer une étape** : clique sur la pastille colorée dans la colonne Étape et
choisis. **C'est enregistré immédiatement**, il n'y a aucun bouton à valider.
La couleur change, et « Dernière action » s'horodate toute seule.

**Prochaine action** : tape directement dans la case, puis clique ailleurs.
La date se choisit dans le petit calendrier juste à côté. Enregistré aussi.

**Chercher** : la barre de recherche cherche dans la raison sociale, le nom, le
mail, mais aussi dans le **SIREN, le mobile, le PDL et le PCE** — et elle ignore
les espaces et les points. Tape `06 12 34 56 78` ou `0612345678`, ça marche pareil.

**Vues rapides** : les quatre boutons (Tout / En travail / À transférer / Clos)
regroupent les étapes. « À transférer » te montre d'un coup les prospects mûrs
(RDV comparatif, Présentation, RIB) qui vont devenir des affaires.

**Trier** : clique sur les titres de colonnes Société, Étape, Prochaine action
ou Dernière action.

**Ouvrir une fiche** : clique sur le nom de la société. Tu y trouves tous les
champs, regroupés en quatre blocs : Entreprise, Contact, Énergie, Suivi.

**Le garde-fou « DFF trop éloigné »** : si tu essaies de mettre un prospect à
cette étape sans avoir renseigné sa date de fin de contrat, l'application
refuse et te le dit en rouge. C'est la base de données qui refuse, pas
l'écran : la règle s'applique quoi qu'il arrive.

> Un commercial ne voit dans cette liste **que ses propres prospects**. Il n'a
> ni le filtre « commercial », ni la colonne « commercial », et le réservoir
> lui est invisible. S'il tape à la main l'adresse de la fiche d'un prospect
> qui n'est pas le sien, il tombe sur « Cette page n'existe pas ».
> Testé en conditions réelles avant livraison.

---

## Étape 4 — Le réservoir, l'import et l'attribution

Menu de gauche → **Administration › Réservoir & attribution**. Cet écran
n'existe que pour toi.

### Importer un fichier de leads

1. Clique **Télécharger le modèle CSV**. Ouvre-le dans Excel ou Google Sheets.
2. Colle tes données dedans, sous la ligne d'exemple (que tu supprimes).
   **Ne renomme pas les colonnes** : c'est leur intitulé qui fait la
   correspondance. Tu peux en supprimer, en laisser vides, les remettre dans
   un autre ordre — mais pas les renommer.
3. Enregistre en CSV. Reviens sur l'écran, **Choisir un fichier**, puis
   **Analyser le fichier**.

> **L'analyse ne modifie rien.** Elle te montre ce qui va se passer avant que
> tu ne valides. Tu peux analyser dix fois sans risque.

Le rapport te donne quatre chiffres : lignes lues, prêtes à importer, doublons
détectés, lignes en erreur. Il te dit aussi quelles colonnes il n'a pas
reconnues et lesquelles manquaient.

### Les doublons

L'application compare **trois clés** : le **SIREN**, le **PDL ou PCE**, et le
**téléphone mobile**. Le mobile est comparé intelligemment : `+33 6 12 34 56 78`
et `0612345678` sont reconnus comme le même numéro.

Pour chaque doublon, elle te dit **où** se trouve l'original :

- « déjà dans ton réservoir » — tu l'as déjà, non attribué
- « déjà travaillé par Aly » — un commercial est dessus, tu sais qui
- « déjà présent plus haut dans le fichier » — le fichier se répète lui-même

**Rien n'est bloqué.** Par défaut les doublons sont écartés ; si tu veux les
importer quand même, coche la case. Ils s'ajouteront sans écraser l'existant.

### La source, obligatoire

Avant de valider, tu dois choisir **d'où viennent ces leads** (call center
Maroc, Tunisie, apporteur, fichier acheté…). C'est ce qui te permettra plus
tard de répondre à « d'où vient cette affaire et qui je paie ». L'application
refuse d'importer sans source.

Tu peux aussi attribuer tout de suite à un commercial, ou laisser dans ton
réservoir pour distribuer plus tard.

### Distribuer

Deux façons :

- **Attribuer un lot** : « toute la source Call center Maroc à Aly », ou
  seulement « les 50 premiers ». Le plus rapide pour alimenter quelqu'un.
- **Réservoir, ligne à ligne** : coche les leads qui t'intéressent et attribue
  la sélection. Utile pour trier à la main.

Un lead attribué **sort du réservoir** et n'apparaît que chez le commercial
concerné. Il ne peut pas se retrouver chez deux personnes : l'attribution ne
prend que des leads encore libres.

### Quand quelqu'un part

**Réattribuer un portefeuille** : tu choisis le commercial à vider et celui qui
récupère. Ses prospects **et** ses affaires changent de main en un clic. Rien
n'est supprimé.

Si tu choisis « Réservoir » comme destination, seuls les prospects reviennent
chez toi : une affaire garde toujours un commercial, sinon on ne saurait plus
à qui verser la commission.

> Chaque changement de main est enregistré dans un journal, avec qui, vers qui
> et quand. Tu ne perds jamais la trace d'un lead.

**Nettoyer les données d'essai** (démonstration + import de test) :

```bash
cd /Users/choisnard/Jeremy_Brain/capella-crm && node scripts/donnees-de-test.mjs supprimer
```

---

## Étape 5 — La conversion

Menu de gauche → **Conversion**.

C'est le pipeline : **six colonnes**, une par étape, avec le nombre d'affaires
et le total des commissions en tête de chaque colonne. Les couleurs sont celles
de ton tableur. Les colonnes défilent horizontalement.

En haut, quatre repères : affaires signées, CA signé, en cours, taux de
conversion.

**Changer une étape** : clique sur la pastille de la carte et choisis.
Pas de glisser-déposer en V1 — on le fera en V1.1 si l'usage réel le réclame.

**Passage à « Signé »** : la date de signature se remplit **toute seule** à la
date du jour si elle est vide. Exactement comme ton script actuel.

**Ouvrir une affaire** : clique sur son nom. Tous les champs de ton ancien
formulaire Google y sont : client, contrat (fournisseur, type d'énergie, PDL,
PCE, CAR, dates), suivi (étape, apporteur, commission, relance, facture, ACD).

Les montants acceptent la **virgule française** : tape `2450,50`, c'est compris.

### Transformer un prospect en affaire

Ouvre la fiche d'un prospect à l'étape **RDV comparatif**, **Présentation** ou
**RIB** : un encadré vert apparaît avec le bouton **Convertir en affaire**.

La fiche affaire s'ouvre **pré-remplie** avec tout ce qu'on sait déjà : raison
sociale, SIREN, contact, téléphone, PDL, PCE, fournisseur actuel, date
d'échéance, notes. Tu n'as plus qu'à compléter le contrat et la commission.

**Le prospect n'est pas supprimé.** Le lien entre les deux est conservé : sur
l'affaire tu vois « issue du prospect PR-000010 », et sur le prospect tu vois
« déjà converti — voir l'affaire CAP-000003 ». Impossible de convertir deux
fois le même prospect.

C'est ça qui remplace le Google Form : les commerciaux créent leurs affaires
directement, soit depuis un prospect, soit par **Nouvelle affaire** pour une
saisie directe.

> Un commercial ne voit que ses propres affaires. Le champ « commercial » ne
> lui est même pas proposé : ce qu'il crée lui est attribué automatiquement.
> S'il tape l'adresse de l'affaire d'un collègue, il tombe sur « Cette page
> n'existe pas ». Testé en conditions réelles avant livraison.

---

## Étape 6 — Le tableau de bord, les commissions et l'export

### Tableau de bord (page d'accueil)

En te connectant, tu arrives sur le **cockpit**. En haut, quatre filtres :
année, mois, commercial, apporteur. Tout se recalcule instantanément.

Six repères : CA signé, affaires signées, taux de conversion, affaires en cours,
commissions des commerciaux, relances à venir. Puis le tableau **commissions par
mois** sur l'année choisie, et deux colonnes de comptage par étape (conversion
et prospection).

> Règle importante, reprise de ton tableur : une affaire compte dans le mois de
> sa **date de signature**, pas de sa date d'entrée. Une affaire signée en mars
> apparaît en mars, même si le prospect date de janvier.

### Commissions

Menu → **Commissions**. Un tableau par commercial : le CA signé mois par mois,
son taux, et la **commission due** (CA × taux). Une ligne de total en bas.

En dessous, le tableau **par apporteur** : combien d'affaires il a apportées, le
CA généré, ce que tu lui dois, et son statut de paiement.

Les mêmes filtres qu'au tableau de bord s'appliquent : tu peux isoler un mois,
un commercial, un apporteur.

> Un commercial qui ouvre cette page ne voit **que sa propre ligne**, intitulée
> « Ma commission ». Pas les autres, pas le bloc apporteurs, pas les filtres par
> personne. Testé en conditions réelles.

### Export complet — ta sauvegarde

Menu → **Administration › Export complet**. Un bouton, un fichier ZIP qui
contient un tableau CSV par catégorie : prospects, affaires, commerciaux,
apporteurs, sources, et le journal des attributions.

Les fichiers s'ouvrent directement dans Excel ou Google Sheets, accents compris.
Les identifiants techniques sont remplacés par les vrais noms.

> **Fais-le une fois par semaine** et garde le fichier ailleurs que sur ton Mac.
> Sur le plan gratuit Supabase, c'est ta seule sauvegarde. Quand le CRM portera
> le business pour de bon, passe au plan Pro (~25 $/mois) : sauvegardes
> quotidiennes automatiques.

---

## Mise à jour v1.1 — à appliquer (10 min)

Cette version ajoute : CAR élec/gaz à la place de Puissance, Nom et Prénom
séparés, une corbeille récupérable, des permissions par personne, et les
pièces jointes ACD / Facture. Trois choses à faire, dans l'ordre.

### 1. Mettre à jour la base (comme au début)

1. Supabase → **SQL Editor** → **New query**.
2. Ouvre le fichier `supabase/migrations/0004_v1_1.sql`, sélectionne tout,
   copie, colle dans Supabase, **Run**.
3. Tu dois voir **Success**. (Le fichier peut être relancé sans risque.)

> Comme ta base est encore vide de vraies données, ce changement ne casse rien.
> C'est exactement pour ça qu'on le fait maintenant, avant la migration de tes
> Sheets.

### 2. Créer l'espace de stockage des fichiers

Le fichier SQL crée normalement l'espace tout seul. On vérifie :

1. Supabase → menu de gauche → **Storage**.
2. Tu dois voir un bucket nommé **`pieces-jointes`**. S'il est là : parfait,
   ne touche à rien, il est déjà privé.
3. **S'il n'y est pas** : clique **New bucket**, nom exact `pieces-jointes`,
   **laisse « Public bucket » décoché** (c'est important : les documents ne
   doivent jamais être accessibles publiquement), puis **Create**.

### 3. Remettre en ligne

Dans le Terminal :

```bash
cd /Users/choisnard/Jeremy_Brain/capella-crm && vercel --prod
```

C'est fait — la nouvelle version est en ligne sur `crm.capellaenergy.fr`.

### Ce que tu peux faire maintenant

- **Nom / Prénom** : deux champs séparés partout.
- **CAR Électricité / CAR Gaz** (en MWh) à la place de Puissance.
- **Supprimer** un prospect ou une affaire : bouton « Supprimer » sur la fiche
  → il part dans **Administration › Corbeille**, d'où tu peux le restaurer ou
  le vider définitivement.
- **Permissions** : dans **Commerciaux**, chaque personne a trois interrupteurs
  — Exporter en CSV, Voir tous les leads (⚠ perce le cloisonnement), Gérer
  l'équipe (⚠ droits d'admin). Toi, tu gardes tout.
- **Documents** : en bas de chaque fiche prospect, deux zones **ACD** et
  **Facture** où déposer plusieurs fichiers (PDF, JPG, PNG — 10 Mo max). Quand
  le prospect devient une affaire, l'affaire affiche automatiquement ces mêmes
  documents.

> Sécurité vérifiée : 25 tests d'isolation automatisés passent, dont les
> nouveaux — un commercial ne voit ni les leads, ni les fichiers d'un autre
> (sauf si tu lui donnes « Voir tous »), et personne ne peut s'auto-attribuer
> une permission.

---

## Mise à jour v1.2 — kanban, sélection multiple, vues rapides, import (5 min)

Quatre ajouts. Une seule chose à faire côté base, puis redéployer.

### 1. Mettre à jour la base

Supabase → **SQL Editor** → **New query** → colle **`supabase/migrations/0005_vues_rapides.sql`** → **Run**. (Rejouable sans risque.)

### 2. Remettre en ligne

```bash
cd /Users/choisnard/Jeremy_Brain/capella-crm && vercel --prod
```

### Ce que tu peux faire

- **Vue kanban** : en Prospection, bouton **Liste / Kanban** en haut à droite.
  Le kanban montre une colonne par étape ; tu changes l'étape via la pastille
  de chaque carte (comme le pipeline de conversion).
- **Suppression en masse** : en vue Liste, coche plusieurs prospects (cases à
  gauche) → une barre apparaît → **Mettre à la corbeille**. Récupérable comme
  d'habitude.
- **Vues rapides à cocher** : en haut de la liste, les boutons rapides sont
  maintenant les étapes que **tu** choisis. Clique **⚙ Personnaliser**, coche
  les étapes voulues, Enregistre. Valable pour toute l'équipe.
- **Import — colonnes non reconnues** : si ton fichier a une colonne dont
  l'intitulé ne correspond à rien, l'analyse te propose de la **rattacher**
  à une colonne existante du CRM (menu déroulant), puis **Ré-analyser**. Plus
  besoin de renommer tes colonnes à la main.

> Vérifié : migration testée et rejouable, et les 25 tests d'isolation passent
> toujours. La suppression en masse et les vues rapides restent réservées à
> l'admin / « gérer l'équipe ».

---

## Mise à jour v1.3 — 7 améliorations (5 min)

Sept nouveautés livrées ensemble. **Une seule chose à faire côté base**, puis
redéployer. Fais-les **dans cet ordre** : la base d'abord, la mise en ligne
ensuite.

### 1. Mettre à jour la base

Supabase → **SQL Editor** → **New query** → colle tout le fichier
**`supabase/migrations/0006_v1_2.sql`** → **Run**. (Rejouable sans risque.)

> Cette mise à jour remplace l'ancien champ unique « Fournisseur actuel » par
> deux champs séparés (Élec / Gaz). La base de prod étant encore vide, rien
> n'est perdu.

### 2. Remettre en ligne

```bash
cd /Users/choisnard/Jeremy_Brain/capella-crm && vercel --prod
```

### Ce que tu peux faire maintenant

1. **Vitesse** — les pages se chargent plus vite : l'appli ne vérifie plus ton
   identité deux fois par page, et les petites listes (sources, apporteurs,
   étapes) ne ralentissent plus l'affichage. Rien à faire, c'est automatique.
2. **Fournisseur Élec / Gaz** — sur la fiche prospect, bloc *Énergie*, deux
   champs distincts au lieu d'un seul. Deux colonnes correspondantes dans le
   modèle d'import CSV (« Fournisseur Élec », « Fournisseur Gaz »).
3. **Numéro affiché** — dans la liste de prospection, la colonne montre le
   **mobile**, et à défaut le **fixe** (avec la mention « (fixe) ») au lieu d'un
   tiret.
4. **Kanban qui reste** — ton choix Liste / Kanban est mémorisé : reviens d'une
   fiche, reclique « Prospection » dans le menu → tu retrouves ta dernière vue.
5. **Créer des sources** — Réservoir → carte **Nouvelle source** : un nom, un
   type, *Créer*. Elle apparaît aussitôt partout où l'on choisit une source.
6. **Corbeille en masse** — dans la Corbeille, coche plusieurs éléments (ou
   *Tout sélectionner*) → **Restaurer la sélection** ou **Supprimer
   définitivement la sélection**.
7. **Champs personnalisés** — Réservoir → carte **Champs personnalisés** : crée
   un champ propre à ton activité (ex. « Marge souhaitée »). Il apparaît alors
   sur **chaque fiche prospect**, et à l'import tu peux **rattacher une colonne
   non reconnue** à ce champ (menu déroulant, groupe « Champs personnalisés »).

> Vérifié : #2 à #5 testés en vrai dans le navigateur (création de source,
> sélection multiple de corbeille, mémorisation de la vue). #1, #6 et #7
> compilent proprement et la migration `0006` a été rejouée sans erreur ; leur
> test « grandeur nature » se fait juste après que tu aies lancé `0006`, car ils
> ajoutent des colonnes à la base. La création de sources et de champs, ainsi
> que la corbeille, restent réservées à l'admin / « gérer l'équipe ».

---

## Ce qui a été mis en place, en clair

**La structure de tes données**

- **Prospects** — ton fichier de prospection, avec toutes tes colonnes actuelles
  (SIREN, PDL, PCE, puissance, fournisseur actuel, date de fin de contrat…).
- **Affaires** — la conversion, avec les mêmes champs que ton formulaire actuel.
- **Commerciaux** — nom, email, taux de commission, actif ou non.
- **Apporteurs** — avec leur taux et leur statut de paiement.
- **Sources** — d'où vient chaque lead (call center Maroc, Tunisie, apporteur,
  fichier acheté…), pour toujours savoir qui tu paies et pourquoi.
- **Historique d'attribution** — chaque changement de propriétaire d'un lead
  est enregistré. Tu pourras toujours répondre à « qui a travaillé cette affaire ».

**Tes automatismes, repris à l'identique**

- Une affaire passe à **Signé** → la date de signature se remplit toute seule.
- Un prospect change d'étape → « Dernière action » est horodatée automatiquement.
- Étape **DFF trop éloigné** → refusée tant que la date de fin de contrat est vide.
- Les codes couleur sont exactement ceux de ton tableur.
- Les libellés d'étapes sont **inchangés** : tes commerciaux ne réapprennent rien.

**La sécurité**

C'est le point le plus important, et c'est fait **au niveau de la base**,
pas de l'application. Concrètement : même si un commercial était malin et
tentait de bricoler ses requêtes, la base elle-même refuserait de lui montrer
les prospects d'un autre. Les règles sont dans `0002_rls.sql`.

- Un commercial ne voit **que** les prospects qui lui sont attribués.
- Il ne peut ni s'attribuer un lead du réservoir, ni en céder un à un collègue.
- Il ne peut pas modifier son propre taux de commission ni son rôle.
- Le réservoir de leads bruts n'est visible **que par toi**.
- Un compte désactivé ne voit plus rien du tout, immédiatement.

Tu vérifieras tout ça toi-même à l'étape 2 : je te ferai créer deux comptes
de test et tu constateras de tes yeux qu'ils ne se voient pas.

---

## Bon à savoir pour la suite

- **Sauvegardes** : le plan gratuit Supabase ne garde pas d'historique long.
  L'écran « Export complet » (étape 6) te permettra de tout télécharger en CSV
  d'un clic. Quand le CRM portera vraiment le business, passe au **plan Pro
  (~25 $/mois)** : sauvegardes quotidiennes automatiques sur 7 jours.
- **Google Sheets** : on ne touche à rien. Tu continueras à l'utiliser en
  parallèle pendant deux semaines avant de couper.
