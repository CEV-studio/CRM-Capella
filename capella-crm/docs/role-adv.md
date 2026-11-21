# Traitement ADV

L’accès ADV est maintenant une permission cumulable, configurée dans l’administration des comptes. La référence actuelle est [Permissions cumulables](permissions.md).

La permission `adv` ouvre le traitement global des dossiers, statuts, commissions, signatures, relances, vérifications d’appels et demandes ACD. Les mutations sensibles passent par des commandes SQL authentifiées. Elle ne donne pas la permission d’administration.

La permission `apporteur` peut être ajoutée au même compte pour créer ses propres affaires et suivre ses commissions personnelles. Les informations clients et les documents restent soumis aux permissions et aux règles de périmètre dans Supabase.
