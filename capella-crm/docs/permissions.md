# Permissions cumulables

L’administration des comptes utilise des cases à cocher, à la création comme à la modification. Les espaces CRM, apporteur, ADV, qualité, équipes, Belgique et messagerie sont cumulables ; l’administration complète, la gestion CRM, la lecture globale et l’export sont accordés explicitement.

`profiles.permissions` est l’unique source des autorisations applicatives. Les contrôles serveur et API, les fonctions SQL et les règles RLS consultent les permissions du profil actif. Les anciennes colonnes de rôle et de droits sont conservées temporairement comme données de compatibilité, sans aucune autorité. Aucun rôle n’est présenté dans la gestion des comptes.

## Migration

La migration convertit une fois les droits existants en permissions équivalentes. Elle conserve l’activation des comptes, les taux, les équipes, les rattachements aux centres et les dossiers. Aucun espace supplémentaire n’est activé pour un utilisateur existant. Les nouveaux comptes créés directement par Auth n’ont aucune permission ; les métadonnées fournies à l’inscription ne peuvent pas accorder un accès.

## Combinaisons

- ADV + apporteur : traitement global ADV/ACD et dépôt de ses propres affaires. Les listes personnelles filtrent `owner_id` ; les listes de traitement sont identifiées séparément. La commission personnelle reste réglable indépendamment.
- Qualité + CRM : contrôle qualité et activité commerciale personnelle, sans accès à la comptabilité brute de Belgique.
- Centre ou encodage Belgique : les permissions ne remplacent pas le rattachement `be_access`. Un centre ou un agent ne peut consulter/encoder que dans son périmètre.
- Retirer ADV conserve les affaires personnelles si la permission apporteur est conservée. Le retrait prend effet sur les requêtes suivantes sans dépendre d’un rôle dans le JWT.

Seule l’administration peut modifier les permissions. Une protection SQL interdit de supprimer ou désactiver la dernière administration active. Les comptes désactivés ne peuvent exercer aucune de leurs permissions.

## Vérification

`npm run test:permissions` couvre la conversion de chaque ancienne catégorie de compte, les gardes serveur/HTTP, la création et modification des comptes, les combinaisons de permissions, les refus d’escalade, la révocation, les dossiers ACD/ADV, les cotations, les documents, Storage, les notifications et les commissions. `npm run test:belgium` et `node tests/crm-read-performance.mjs` contrôlent les parcours existants et les requêtes CRM. La compilation de production est exécutée avec `npm run build`.

`tests/adv-production-smoke.sql` utilise des comptes fictifs dans une transaction intégralement annulée, pour vérifier les autorisations sur PostgreSQL de production sans attribuer de nouveaux droits à une personne réelle. Les tests ne déclenchent pas d’envoi d’email réel.
