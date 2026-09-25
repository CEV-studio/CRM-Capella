# Parcours apporteur

## Activation

1. Appliquer `supabase/migrations/20260924133505_apporteur_portal.sql` à la base du CRM avant d'activer les nouveaux comptes. La migration est transactionnelle, conserve les dossiers existants et ajoute le rôle `apporteur`.
2. Déployer ce commit avec les variables Supabase existantes (URL, clé publique et clé de service côté serveur).
3. Dans **Équipe & apporteurs**, créer un compte **Apporteur**. Les commerciaux existants conservent leur rôle. Un administrateur peut changer le rôle d'un compte ; cela retire ses permissions globales. Les anciens prospects d'un commercial ne sont pas automatiquement convertis en opportunités apporteur.
4. Connecter/attribuer une boîte Gmail avec droit d'envoi au profil administrateur `jeremy@capellaenergy.fr`, avec les variables OAuth/chiffrement Gmail existantes. Les notifications CRM sont créées dans la même transaction que l'action métier. Les mails sont envoyés après cette transaction, avec leur état de livraison enregistré. Une panne mail ne supprime pas la demande. L'administrateur peut relancer les échecs dans **Notifications**. Aucun envoi de test n'est effectué par la migration.

## Parcours

- Opportunité : SIRET (recherche Entreprises, saisie manuelle en secours), informations ACD obligatoires identiques au formulaire existant, compteurs et factures. Un brouillon récupérable est créé avant l'envoi des pièces. La soumission est transactionnelle et affiche immédiatement « ACD envoyée » côté apporteur. L'envoi réel demeure externe.
- Renvoi : bouton tant que l'ACD attend sa signature ; nouvelle notification, temporisation de 5 minutes contre les doubles clics.
- Signature ACD : l'administrateur choisit « Terminée — ACD signée ». Cela notifie l'apporteur et ouvre la cotation, sans créer automatiquement d'affaire pour ce parcours.
- Cotation : dates communes de début/fin et date souhaitée, commentaire, PDL/PCE multiples, cases Régie/Marché/Autre. Une période différente nécessite une nouvelle demande. Les retries réutilisent une clé idempotente. Chaque demande crée une affaire dans l'ADV existant.
- Documents : PDF/JPG/PNG, 10 Mo maximum par fichier, stockage privé ; les offres peuvent être ajoutées par l'administrateur dans la fiche. L'onglet échanges permet la demande d'envoi du contrat liée à une cotation.
- ADV : case « Appels de vérification » dans une table réservée aux administrateurs ; case de suivi non bloquante. Commission apporteur projetée au moment où l'ADV valide « Signé », selon le taux du profil. Une modification explicite de commission globale la recalcule ; les autres changements conservent le montant historique. La marge globale n'est pas accessible au rôle apporteur.

## Vérification

- `npm run test:partners` reconstruit les migrations dans un Postgres embarqué (PGlite), puis exerce ACD/cotation/signature et les permissions avec deux apporteurs et un administrateur. Auth et Storage sont simulés ; ce test ne valide pas la livraison Gmail ni l'hébergement.
- `npx tsc --noEmit` et `npm run build -- --webpack`.
- Après activation, vérifier avec deux comptes réels : création avec facture, validation ACD administrateur, notification/mails, cotation multi-compteurs, demande de contrat, vérification ADV et commission après signature.

Les deux accès Supabase testés pendant le développement ont expiré sans réponse. La migration a été vérifiée localement, mais n'a pas été appliquée à une base distante dans cette session. Aucun envoi réel de mail n'a été testé.
