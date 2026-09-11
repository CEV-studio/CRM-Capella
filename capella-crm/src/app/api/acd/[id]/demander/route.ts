import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type MeterInput = { energy_type?:unknown; identifier?:unknown; contract_expiry?:unknown; address?:unknown; postal_code?:unknown; city?:unknown };
const clean = (value:unknown) => String(value ?? "").trim();

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  await requireProfile();
  const {id}=await params;
  const supabase=await createClient();const db=supabase as any;
  const {data:prospect}=await db.from("prospects").select("id,raison_sociale,siren,prenom,nom,mail,tel_mobile,tel_fixe,pdl,pce,code_postal,entreprise_id").eq("id",id).is("deleted_at",null).maybeSingle();
  if(!prospect)return NextResponse.json({error:"Prospect introuvable."},{status:404});
  const [{data:company},{data:meters}]=await Promise.all([
    prospect.entreprise_id?db.from("entreprises").select("adresse,code_postal,ville").eq("id",prospect.entreprise_id).maybeSingle():Promise.resolve({data:null}),
    prospect.entreprise_id?db.from("prospect_compteurs").select("type_energie,numero,siret,date_echeance,adresse,code_postal,ville").eq("entreprise_id",prospect.entreprise_id).is("archived_at",null).order("created_at"):Promise.resolve({data:[]}),
  ]);
  return NextResponse.json({id:prospect.id,raison_sociale:prospect.raison_sociale,siren:prospect.siren,siret:(meters??[]).find((meter:any)=>meter.siret)?.siret??null,company_address:company?.adresse??null,company_postal_code:company?.code_postal??prospect.code_postal,company_city:company?.ville??null,prenom:prospect.prenom,nom:prospect.nom,mail:prospect.mail,telephone:prospect.tel_mobile||prospect.tel_fixe,pdl:prospect.pdl,pce:prospect.pce,meters:(meters??[]).map((meter:any)=>({type_energie:meter.type_energie,numero:meter.numero,date_echeance:meter.date_echeance,adresse:meter.adresse,code_postal:meter.code_postal,ville:meter.ville}))});
}

export async function POST(request:Request,{ params }:{ params:Promise<{id:string}> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string,unknown> & { meters?:MeterInput[] };
  const supabase = await createClient();
  const { data:prospect } = await supabase.from("prospects").select("id, stage, assigned_to, entreprise_id").eq("id",id).is("deleted_at",null).maybeSingle();
  if (!prospect) return NextResponse.json({error:"Prospect introuvable."},{status:404});
  if (profile.role !== "admin" && prospect.assigned_to !== profile.id) return NextResponse.json({error:"Cette fiche ne t’est pas attribuée."},{status:403});

  const siren=clean(body.siren).replace(/\s/g,"");
  const siret=clean(body.siret).replace(/\s/g,"");
  const required:[string,string][]=[["raison sociale",clean(body.raison_sociale)],["SIREN",siren],["SIRET",siret],["adresse du siège",clean(body.company_address)],["code postal du siège",clean(body.company_postal_code)],["ville du siège",clean(body.company_city)],["prénom du signataire",clean(body.signatory_first_name)],["nom du signataire",clean(body.signatory_last_name)],["e-mail du signataire",clean(body.signatory_email)],["téléphone du signataire",clean(body.signatory_phone)],["fonction du signataire",clean(body.signatory_role)]];
  const missing=required.filter(([,value])=>!value).map(([label])=>label);
  if (missing.length) return NextResponse.json({error:`Champs manquants : ${missing.join(", ")}.`},{status:400});
  if (!/^\d{9}$/.test(siren)) return NextResponse.json({error:"Le SIREN doit contenir 9 chiffres."},{status:400});
  if (!/^\d{14}$/.test(siret) || !siret.startsWith(siren)) return NextResponse.json({error:"Le SIRET doit contenir 14 chiffres et commencer par le SIREN."},{status:400});
  if (!/^\d{5}$/.test(clean(body.company_postal_code))) return NextResponse.json({error:"Le code postal du siège doit contenir 5 chiffres."},{status:400});
  if (!["representant_legal","mandataire"].includes(clean(body.signatory_capacity))) return NextResponse.json({error:"Qualité du signataire invalide."},{status:400});

  const meters=(Array.isArray(body.meters)?body.meters:[]).map((meter,index)=>({ position:index, energy_type:clean(meter.energy_type), identifier:clean(meter.identifier).replace(/\s/g,""), contract_expiry:clean(meter.contract_expiry), address:clean(meter.address), postal_code:clean(meter.postal_code), city:clean(meter.city) }));
  if (!meters.length) return NextResponse.json({error:"Ajoute au moins un PDL ou un PCE."},{status:400});
  const invalid=meters.find((meter)=>!["electricite","gaz"].includes(meter.energy_type)||!/^\d{14}$/.test(meter.identifier)||!/^\d{4}-\d{2}-\d{2}$/.test(meter.contract_expiry)||!meter.address||!/^\d{5}$/.test(meter.postal_code)||!meter.city);
  if (invalid) return NextResponse.json({error:"Chaque compteur doit avoir une énergie, un PDL/PCE de 14 chiffres, une échéance et une adresse complète."},{status:400});

  const db=supabase as any;
  const { data:active }=await db.from("acd_requests").select("id").eq("prospect_id",id).in("status",["a_traiter","en_cours"]).maybeSingle();
  if (active) return NextResponse.json({error:"Une demande d’ACD est déjà en cours pour cette fiche."},{status:409});
  const { data:acd,error }=await db.from("acd_requests").insert({ prospect_id:id, requested_by:profile.id, raison_sociale:clean(body.raison_sociale), siren, siret, company_address:clean(body.company_address), company_postal_code:clean(body.company_postal_code), company_city:clean(body.company_city), signatory_first_name:clean(body.signatory_first_name), signatory_last_name:clean(body.signatory_last_name), signatory_email:clean(body.signatory_email), signatory_phone:clean(body.signatory_phone), signatory_capacity:clean(body.signatory_capacity), signatory_role:clean(body.signatory_role), notes:clean(body.notes)||null }).select("id").single();
  if (error||!acd) return NextResponse.json({error:error?.message||"Création impossible."},{status:400});
  const { error:meterError }=await db.from("acd_request_meters").insert(meters.map((meter)=>({...meter,request_id:acd.id})));
  if (meterError) { await db.from("acd_requests").delete().eq("id",acd.id); return NextResponse.json({error:meterError.message},{status:400}); }

  const premierPdl=meters.find((meter)=>meter.energy_type==="electricite")?.identifier??null;
  const premierPce=meters.find((meter)=>meter.energy_type==="gaz")?.identifier??null;
  const premiereEcheance=[...meters].sort((a,b)=>a.contract_expiry.localeCompare(b.contract_expiry))[0]?.contract_expiry??null;
  const {error:prospectError}=await supabase.from("prospects").update({
    raison_sociale:clean(body.raison_sociale),
    siren,
    prenom:clean(body.signatory_first_name),
    nom:clean(body.signatory_last_name),
    mail:clean(body.signatory_email),
    tel_mobile:clean(body.signatory_phone),
    code_postal:clean(body.company_postal_code),
    ...(premierPdl?{pdl:premierPdl}:{}),
    ...(premierPce?{pce:premierPce}:{}),
    date_fin_contrat:premiereEcheance,
    stage:"Demande ACD",
    last_action_at:new Date().toISOString(),
  }).eq("id",id);
  if(prospectError){await db.from("acd_requests").delete().eq("id",acd.id);return NextResponse.json({error:prospectError.message},{status:400});}

  if(prospect.entreprise_id){
    const {error:companyError}=await db.from("entreprises").update({
      raison_sociale:clean(body.raison_sociale),
      siren,
      adresse:clean(body.company_address),
      code_postal:clean(body.company_postal_code),
      ville:clean(body.company_city),
    }).eq("id",prospect.entreprise_id);
    if(companyError)return NextResponse.json({error:`ACD créée, mais la fiche entreprise n’a pas pu être mise à jour : ${companyError.message}`},{status:400});
  }

  for(const meter of meters){
    const {data:existing,error:lookupError}=await db.from("prospect_compteurs").select("id").eq("prospect_id",id).eq("type_energie",meter.energy_type).eq("numero",meter.identifier).is("archived_at",null).limit(1).maybeSingle();
    if(lookupError)return NextResponse.json({error:`ACD créée, mais la recherche du compteur ${meter.identifier} a échoué : ${lookupError.message}`},{status:400});
    const compteurPatch={
      entreprise_id:prospect.entreprise_id??null,
      siret,
      date_echeance:meter.contract_expiry,
      adresse:meter.address,
      code_postal:meter.postal_code,
      ville:meter.city,
    };
    const compteurResult=existing
      ? await db.from("prospect_compteurs").update(compteurPatch).eq("id",existing.id)
      : await db.from("prospect_compteurs").insert({prospect_id:id,type_energie:meter.energy_type,numero:meter.identifier,...compteurPatch});
    if(compteurResult.error)return NextResponse.json({error:`ACD créée, mais le compteur ${meter.identifier} n’a pas pu être enregistré dans la fiche : ${compteurResult.error.message}`},{status:400});
  }
  return NextResponse.json({ok:true,id:acd.id});
}
