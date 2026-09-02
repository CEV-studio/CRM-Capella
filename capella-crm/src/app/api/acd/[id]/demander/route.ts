import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type MeterInput = { energy_type?:unknown; identifier?:unknown; contract_expiry?:unknown; address?:unknown; postal_code?:unknown; city?:unknown };
const clean = (value:unknown) => String(value ?? "").trim();

export async function POST(request:Request,{ params }:{ params:Promise<{id:string}> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string,unknown> & { meters?:MeterInput[] };
  const supabase = await createClient();
  const { data:prospect } = await supabase.from("prospects").select("id, stage, assigned_to").eq("id",id).is("deleted_at",null).maybeSingle();
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
  const {error:stageError}=await supabase.from("prospects").update({stage:"Demande ACD",last_action_at:new Date().toISOString()}).eq("id",id);
  if(stageError){await db.from("acd_requests").delete().eq("id",acd.id);return NextResponse.json({error:stageError.message},{status:400});}
  return NextResponse.json({ok:true,id:acd.id});
}
