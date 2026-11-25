import { hasAnyPermission } from '@/lib/permissions';
import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { applyQualityConditions, calculateQuality, QUALITY_RUBRICS, type QualityRubricKey, validateQualityAnswers, isQualityEligibleSale } from "@/lib/quality";
import { loadBelgiumProduction } from '@/lib/belgium/server';
import { validatedTextMentions } from '@/lib/quality-mentions';
import { norm } from '@/lib/belgium/domain';

export async function POST(request: NextRequest) {
  const profile = await requireProfile();
  if (!hasAnyPermission(profile,['administration','qualite'])) return NextResponse.json({error:"Accès refusé."},{status:403});
  let body: unknown;
  try { body=await request.json(); } catch { return NextResponse.json({error:"Données invalides."},{status:400}); }
  if (!body || typeof body !== 'object') return NextResponse.json({error:"Données invalides."},{status:400});
  const input=body as Record<string,unknown>;
  const rubricKey=typeof input.rubric_key==='string'?input.rubric_key:'';
  if(!Object.prototype.hasOwnProperty.call(QUALITY_RUBRICS,rubricKey))return NextResponse.json({error:"Ce barème n’est pas configuré."},{status:400});
  const rubric=QUALITY_RUBRICS[rubricKey as QualityRubricKey];
  const saleKey=typeof input.sale_key==='string'?input.sale_key.trim():'';
  if(!saleKey||saleKey.length>160)return NextResponse.json({error:"Sélectionnez une vente dans la base clients."},{status:400});
  const production=await loadBelgiumProduction();
  const sale=production.contracts.find(c=>c.key===saleKey&&c.supplier==='MEGA'&&['Elec','Gaz'].includes(c.energy)&&isQualityEligibleSale(c.status_class));
  if(!sale)return NextResponse.json({error:"Cette vente n’est plus accessible dans la base clients."},{status:404});
  const clientKey=sale.client_id||sale.mega_id||sale.key;
  const db=await createClient();
  if(input.shared_call_already_reviewed===true){
    // A score may be reused only for the other energy of the same identifiable client and agent.
    const counterpart=production.contracts.find(c=>c.key!==sale.key&&c.supplier==='MEGA'&&['Elec','Gaz'].includes(c.energy)&&c.energy!==sale.energy&&
      ((sale.client_id&&c.client_id===sale.client_id)||(sale.mega_id&&c.mega_id===sale.mega_id))&&
      norm(c.client)===norm(sale.client)&&norm(c.agent)===norm(sale.agent)&&norm(c.centre)===norm(sale.centre));
    if(!counterpart)return NextResponse.json({error:'Aucune vente gaz/électricité correspondante pour ce client et cet agent. Choisissez « Non » pour contrôler cet appel.'},{status:400});
    const {data:source,error:sourceError}=await db.from('quality_reviews').select('*').eq('sale_key',counterpart.key).order('reviewed_at',{ascending:false}).limit(1).maybeSingle();
    if(sourceError)return NextResponse.json({error:'Lecture du contrôle précédent impossible.'},{status:500});
    if(!source)return NextResponse.json({error:'L’autre énergie doit être contrôlée avant de pouvoir valider « Oui ».'},{status:400});
    const {data:existing,error:existingError}=await db.from('quality_reviews').select('id').eq('sale_key',sale.key).limit(1).maybeSingle();
    if(existingError)return NextResponse.json({error:'Vérification du contrôle impossible.'},{status:500});
    if(existing)return NextResponse.json({error:'Cette vente figure déjà dans les ventes contrôlées.'},{status:409});
    const originalId=typeof source.identification?.shared_call_source_id==='string'?source.identification.shared_call_source_id:source.id;
    const {data,error}=await db.from('quality_reviews').insert({
      activity_name:'MEGA',rubric_key:source.rubric_key,agent_name:sale.agent,agent_centre:sale.centre,
      sale_reference:sale.key,sale_key:sale.key,client_key:clientKey,
      identification:{shared_call_source_id:originalId},condition_context:{...source.condition_context,shared_call_already_reviewed:true},
      answers:source.answers,score_sum:source.score_sum,applicable_count:source.applicable_count,max_score:source.max_score,
      score_percent:source.score_percent,status:source.status,grave_faults:source.grave_faults,
      call_quality_note:source.call_quality_note,comments:null,controller_id:profile.id,controller_name:profile.full_name,
    }).select('id').single();
    if(error||!data)return NextResponse.json({error:'Enregistrement du contrôle commun impossible.'},{status:500});
    return NextResponse.json({id:data.id,client_key:clientKey,score:source.score_percent,status:source.status},{status:201});
  }
  if(input.shared_call_already_reviewed!==false)return NextResponse.json({error:'Précisez la réponse à Q1.'},{status:400});
  const conditions=input.conditions;
  if(!conditions||typeof conditions!=='object'||rubric.conditionRules.some(rule=>typeof (conditions as Record<string,unknown>)[rule.field]!=='boolean'))return NextResponse.json({error:"Précisez les conditions d’application du barème."},{status:400});
  const conditionValues=conditions as Record<string,boolean>;
  const answers=applyQualityConditions(input.answers,conditionValues,rubric.conditionRules);
  if (!validateQualityAnswers(answers,rubric.questions,rubric.conditionRules.map(rule=>rule.questionId))) return NextResponse.json({error:"Notez chaque critère de 0 à 5."},{status:400});
  const invalidRule=rubric.conditionRules.find(rule=>answers[String(rule.questionId)].kind==='na'&&conditionValues[rule.field]!==rule.naWhen);
  if(invalidRule)return NextResponse.json({error:`Q${invalidRule.questionId} : choisissez une note de 0 à 5 pour cette condition.`},{status:400});
  // Ces deux critères sont évalués par la condition et la note, sans texte associé.
  for(const questionId of [14,25]){answers[String(questionId)].comment='';answers[String(questionId)].reason='';}
  const note=typeof input.call_quality_note==='string'?input.call_quality_note.trim():'';
  if(!['1','2','3','4','5'].includes(note))return NextResponse.json({error:'Note Q26 requise (1 à 5).'},{status:400});
  const comments=typeof input.comments==='string'?input.comments.trim():'';
  if(comments.length>10000)return NextResponse.json({error:'Synthèse trop longue.'},{status:400});
  let mentionedIds:string[];
  try{mentionedIds=await validatedTextMentions(input.mentioned_ids||[],comments);}catch(error){return NextResponse.json({error:(error as Error).message},{status:400});}
  const score=calculateQuality(answers,rubric.questions);
  if(score.score_percent===null||score.status===null)return NextResponse.json({error:"Aucun critère applicable au calcul."},{status:400});
  const {data,error}=await db.from('quality_reviews').insert({
    activity_name:'MEGA',rubric_key:rubric.key,agent_name:sale.agent,agent_centre:sale.centre,sale_reference:sale.key,sale_key:sale.key,
    identification:{},condition_context:{...conditionValues,shared_call_already_reviewed:false},answers,score_sum:score.score_sum,applicable_count:score.applicable_count,max_score:rubric.maxScore,
    score_percent:Number(score.score_percent.toFixed(4)),status:score.status,grave_faults:score.grave_faults,
    call_quality_note:note||null,comments:comments||null,mentioned_ids:mentionedIds,client_key:clientKey,controller_id:profile.id,controller_name:profile.full_name,
  }).select('id').single();
  if(error||!data)return NextResponse.json({error:"Enregistrement impossible."},{status:500});
  return NextResponse.json({id:data.id,client_key:clientKey,score:score.score_percent,status:score.status},{status:201});
}
