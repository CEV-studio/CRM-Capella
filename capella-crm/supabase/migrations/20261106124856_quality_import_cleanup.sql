-- Conserver les points du rapport qualité dans les fiches clients concernées.
insert into public.be_client_comments(mega_id,centre,author_id,author_name,body,created_at,updated_at)
select '3848326','TILIRA',p.id,p.full_name,
 'Rapport qualité du 06/11 : tarif social et gaz présents au contrat, mais seul l’électricité est évoquée dans l’appel. Contrôles de 05:07 et 05:10 : le même contrat gaz a été contrôlé deux fois ; reprendre le contrôle de l’électricité.',
 i.reported_at,i.reported_at
from public.quality_incidents i join public.profiles p on lower(p.email)='thibault@capellaenergy.fr'
where i.id='9dbe740c-92a2-4697-adcb-d81f002558d8' and i.source='email'
 and not exists(select 1 from public.be_client_comments c where c.mega_id='3848326' and c.body like 'Rapport qualité du 06/11 : tarif social%');

insert into public.be_client_comments(mega_id,centre,author_id,author_name,body,created_at,updated_at)
select '3848140','TILIRA',p.id,p.full_name,
 'Rapport qualité du 06/11 : l’appel ne traite que de l’électricité alors que les contrats gaz et électricité sont à contrôler. Reprendre le contrôle du gaz.',
 i.reported_at,i.reported_at
from public.quality_incidents i join public.profiles p on lower(p.email)='thibault@capellaenergy.fr'
where i.id='9dbe740c-92a2-4697-adcb-d81f002558d8' and i.source='email'
 and not exists(select 1 from public.be_client_comments c where c.mega_id='3848140' and c.body like 'Rapport qualité du 06/11 : l’appel%');

-- Les trois imports expérimentaux (dont deux échanges RH sans rapport avec la qualité)
-- ne doivent plus apparaître comme des signalements CRM.
delete from public.crm_notifications n using public.quality_incidents i
where i.source='email' and n.href='/qualite/signalements/'||i.id;
delete from public.quality_incidents where source='email';
