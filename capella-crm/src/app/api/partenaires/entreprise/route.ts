import { NextResponse } from 'next/server';
import { partnerContext } from '@/lib/partners/server';
export async function GET(request:Request){
 await partnerContext();
 const siret=new URL(request.url).searchParams.get('siret')??'';
 if(!/^\d{14}$/.test(siret))return NextResponse.json({error:'Le SIRET doit contenir 14 chiffres.'},{status:400});
 try{
  const response=await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=5`,{next:{revalidate:86400},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error();
  const data=await response.json();
  for(const company of data.results??[]){
   const site=[company.siege,...(company.matching_etablissements??[])].find(s=>s?.siret===siret);
   if(site)return NextResponse.json({raison_sociale:company.nom_complet||company.nom_raison_sociale,company_address:site.geo_adresse||site.adresse||'',company_postal_code:site.code_postal||'',company_city:site.libelle_commune||''});
  }
  return NextResponse.json({error:'SIRET non trouvé. Vous pouvez compléter les informations manuellement.'},{status:404});
 }catch{return NextResponse.json({error:'Recherche indisponible. Vous pouvez compléter les informations manuellement.'},{status:503});}
}
