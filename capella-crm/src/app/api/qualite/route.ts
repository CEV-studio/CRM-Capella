import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculateQuality, QUALITY_RUBRICS, type QualityRubricKey, validateQualityAnswers } from "@/lib/quality";
import { loadBelgiumProduction } from '@/lib/belgium/server';

export async function POST(request: NextRequest) {
  const profile = await requireProfile();
  if (!['admin','qualite'].includes(profile.role)) return NextResponse.json({error:"Accès refusé."},{status:403});
  let body: unknown;
  try { body=await request.json(); } catch { return NextResponse.json({error:"Données invalides."},{status:400}); }
  if (!body || typeof body !== 'object') return NextResponse.json({error:"Données invalides."},{status:400});
  const input=body as Record<string,unknown>;
  const rubricKey=typeof input.rubric_key==='string'?input.rubric_key:'';
  if(!Object.prototype.hasOwnProperty.call(QUALITY_RUBRICS,rubricKey))return NextResponse.json({error:"Ce barème n’est pas configuré."},{status:400});
  const rubric=QUALITY_RUBRICS[rubricKey as QualityRubricKey];
  if (!validateQualityAnswers(input.answers,rubric.questions,rubric.conditionRules.map(rule=>rule.questionId))) return NextResponse.json({error:"Répondez à chaque question et renseignez les motifs et justificatifs requis."},{status:400});
  const conditions=input.conditions;
  if(!conditions||typeof conditions!=='object'||rubric.conditionRules.some(rule=>typeof (conditions as Record<string,unknown>)[rule.field]!=='boolean'))return NextResponse.json({error:"Précisez les conditions d’application du barème."},{status:400});
  const conditionValues=conditions as Record<string,boolean>;
  const answers=input.answers;
  if(rubric.conditionRules.some(rule=>(answers[String(rule.questionId)].kind==='na')!==(conditionValues[rule.field]===rule.naWhen)))return NextResponse.json({error:"La réponse N/A ne correspond pas à la condition d’application du barème."},{status:400});
  if (!input.identification || typeof input.identification !== 'object' || Array.isArray(input.identification)) return NextResponse.json({error:"Les champs d’identification sont invalides."},{status:400});
  const identification=input.identification as Record<string,unknown>;
  if (Object.keys(identification).some(key=>!/^([1-7])$/.test(key)) || Object.values(identification).some(value=>typeof value!=='string'||value.length>1000)) return NextResponse.json({error:"Les champs d’identification sont invalides."},{status:400});
  const identificationValues=Object.fromEntries(Object.entries(identification).map(([key,value])=>[key,value as string]));
  const saleKey=typeof input.sale_key==='string'?input.sale_key.trim():'';
  if(!saleKey||saleKey.length>160)return NextResponse.json({error:"Sélectionnez une vente dans la base clients."},{status:400});
  const production=await loadBelgiumProduction();
  const sale=production.contracts.find(c=>c.key===saleKey&&c.supplier==='MEGA'&&['Elec','Gaz'].includes(c.energy));
  if(!sale)return NextResponse.json({error:"Cette vente n’est plus accessible dans la base clients."},{status:404});
  const note=typeof input.call_quality_note==='string'?input.call_quality_note.trim():'';
  const comments=typeof input.comments==='string'?input.comments.trim():'';
  if(note.length>2000||comments.length>10000)return NextResponse.json({error:"Un commentaire dépasse la longueur autorisée."},{status:400});
  const score=calculateQuality(input.answers,rubric.questions);
  if(score.score_percent===null||score.status===null)return NextResponse.json({error:"Aucun critère applicable au calcul."},{status:400});
  const db=await createClient();
  const {data,error}=await db.from('quality_reviews').insert({
    activity_name:'MEGA',rubric_key:rubric.key,agent_name:sale.agent_reference||sale.agent,sale_reference:sale.key,sale_key:sale.key,
    identification:identificationValues,condition_context:conditionValues,answers:input.answers,score_sum:score.score_sum,applicable_count:score.applicable_count,
    score_percent:Number(score.score_percent.toFixed(4)),status:score.status,grave_faults:score.grave_faults,
    call_quality_note:note||null,comments:comments||null,controller_id:profile.id,controller_name:profile.full_name,
  }).select('id').single();
  if(error||!data)return NextResponse.json({error:"Enregistrement impossible."},{status:500});
  return NextResponse.json({id:data.id,score:score.score_percent,status:score.status},{status:201});
}
