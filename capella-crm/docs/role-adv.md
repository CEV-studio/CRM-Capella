# Rôle ADV

Le rôle `adv` est attribuable uniquement par l’administrateur dans la création ou la modification des comptes. Cette livraison n’attribue ce rôle à aucun utilisateur existant. Les comptes ADV ne reçoivent aucun droit `can_manage_team`, `can_view_all` ou `can_export`, ni de commission personnelle.

## Accès

- Accueil et navigation consacrés aux dossiers ADV et aux demandes ACD.
- Lecture des affaires actives, des demandes ACD et de leurs compteurs, et des informations clients et apporteurs associées au traitement.
- Consultation, ajout et téléchargement des pièces du dossier ; accès Storage limité aux chemins des dossiers autorisés.
- Statuts ADV, commission globale, date de signature, relance et vérification des appels par commande SQL ciblée.
- Traitement ACD par commande atomique : mise à jour du statut, création ou réutilisation d’une affaire pour une demande commerciale, synchronisation du dossier apporteur et notifications existantes.
- Le parcours apporteur conserve sa demande explicite de cotation après signature de l’ACD. ADV peut créer cette cotation, publier des documents et échanger sur le dossier.
- Refus des fonctions d’administration générale, des exports, de la comptabilité, des boîtes email, du réservoir et des données Belgique.

Les restrictions commerciales existantes sur la commission, la signature et le traitement ACD sont aussi imposées par des triggers, y compris lors d’un accès direct à Supabase. Les éditions commerciales ordinaires et le passage en KO sont conservés.

Les règles applicatives et les règles RLS sont complémentaires. Les écritures arbitraires REST sur les affaires, prospects et demandes ACD sont refusées à ADV ; les RPC privées vérifient le rôle actif dans `profiles`. Les profils complets restent privés ; `adv_directory` expose uniquement les noms et taux nécessaires aux dossiers. Les notifications propres peuvent être marquées lues, sans modifier le destinataire ou le contenu des emails.

## Vérification

- `npm run test:adv` : tests des gardes serveur, de la matrice HTTP du proxy et des actions de création/modification de comptes ; migrations complètes et tests réels PostgreSQL via PGlite pour les profils ADV actif, ADV désactivé, commercial, apporteur et administrateur.
- La suite SQL vérifie également les pièces et Storage, les commissions, les notifications, les refus d’escalade, la création de cotation, les tentatives répétées et le rollback complet en cas d’échec.
- `npm run test:belgium` : non-régression des parcours Belgique, finances et comptes centres.
- `tests/adv-production-smoke.sql` : contrôle sur PostgreSQL de production avec des comptes et dossiers fictifs, dans une transaction intégralement annulée ; l’empreinte des 15 profils existants est identique avant et après.
- `npm run build` : compilation de production Next.js et vérification TypeScript.
- Le lint global a des erreurs déjà présentes sur la branche principale. La nouvelle livraison n’ajoute pas de diagnostic ; les erreurs existantes ne sont pas corrigées hors du périmètre de ce rôle.

Les tests fonctionnels utilisent des comptes fictifs et des clients simulés pour les gardes HTTP. Aucun compte utilisateur réel n’a été converti en ADV pour les tests. L’envoi effectif des emails dépend de la boîte Gmail d’administration configurée ; les notifications CRM sont conservées même en cas d’échec de l’email. Les liens de téléchargement signés restent valables 60 secondes après leur émission.
