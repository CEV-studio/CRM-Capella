export type AnswerKind = "score" | "grave" | "na";
export type QualityAnswer = { kind: AnswerKind; score: number | null; comment: string; reason: string };
export type QualityStatus = "Conforme" | "À consolider" | "Insuffisant" | "Non conforme — faute grave";
export const QUALITY_ELIGIBLE_SALE_STATUSES = ['Effectif', 'Salle d’attente'] as const;
export const isQualityEligibleSale = (status:string) => QUALITY_ELIGIBLE_SALE_STATUSES.some(value=>value===status);

// Formulations et repères repris de la grille fournie. Les éléments que cette grille
// renvoie à une « liste de la grille actuelle » restent signalés comme tels.
export const MEGA_QUALITY_QUESTIONS = [
  { id:8, criterion:"Identité agent + entreprise mentionnées", grave:true, guidance:"4 si les deux sont clairement mentionnées ; dégrader selon omission / imprécision. FG si l’identité de l’agent et celle de l’entreprise ne sont pas mentionnées, conformément au critère actuel." },
  { id:9, criterion:"Nom du prospect mentionné", grave:true, guidance:"4 si mentionné correctement ; dégrader si tardif ou approximatif. FG si absent." },
  { id:10, criterion:"Nature commerciale expliquée : économies sur contrat(s) énergie", grave:true, guidance:"4 si l’objet est clair ; dégrader selon clarté / complétude. FG si non expliqué." },
  { id:11, criterion:"Interruption dans les 4 situations listées", grave:true, guidance:"4 si l’appel est interrompu lorsqu’un cas se présente ; note réduite si interruption tardive ou hésitante sans poursuite fautive. FG si l’agent sait qu’il doit interrompre et ne le fait pas." },
  { id:12, criterion:"Simulation tarifaire réalisée et envoyée directement par e-mail", grave:true, guidance:"4 si réalisée et envoyée ; FG si l’une des deux actions obligatoires manque." },
  { id:13, criterion:"Consommation annuelle demandée", grave:true, guidance:"4 si demandée clairement ; FG si non demandée." },
  { id:14, criterion:"Enquête utilisée si consommation annuelle indisponible", grave:true, conditional:"N/A si consommation annuelle disponible.", guidance:"Si consommation disponible : N/A. Sinon 4 si enquête utilisée correctement ; dégrader si enquête incomplète ; FG si non utilisée." },
  { id:15, criterion:"Présentation complète de l’offre (produit, fixe/variable, kWh, montants annuel/mensuel, économie si comparaison)", grave:true, guidance:"4 si tous les éléments applicables sont présentés clairement ; dégrader par élément manquant / imprécis. FG si l’offre n’est pas présentée comme requis." },
  { id:16, criterion:"Prospect réceptif, accepte sans contrainte", grave:false, guidance:"4 si réceptivité et accord libre sont clairs ; 3 si accord clair mais vérification faible ; 2 si signaux ambigus ; 1 si pression perceptible ; 0 si absence d’accord ou contrainte." },
  { id:17, criterion:"Informations sur contrat actuel ; adaptation date de début si contrat fixe et date de fin connue", grave:false, guidance:"4 si question posée et règle appliquée ; dégrader selon information manquante ou date non adaptée." },
  { id:18, criterion:"Informations nécessaires à l’inscription, et rien de plus ; vérifier panneaux solaires et date d’index annuelle si oui", grave:false, guidance:"4 si collecte complète et proportionnée, avec règle solaire appliquée si nécessaire ; dégrader selon oubli / collecte superflue." },
  { id:19, criterion:"Prélèvement automatique + factures e-mail proposés ; argumentation si hésitation ; domiciliation partielle expliquée si utile", grave:false, guidance:"4 si proposition et explications adaptées sont faites ; dégrader selon élément omis ou réponse à l’hésitation insuffisante." },
  { id:20, criterion:"E-mail parcouru avec prospect ; coordonnées, adresse, date début, cartes tarifaires et paiement vérifiés", grave:false, guidance:"4 si tous les éléments sont vérifiés avec le prospect ; dégrader selon oubli / vérification partielle." },
  { id:21, criterion:"Prospect sait que le clic génère contrat et changement de fournisseur", grave:true, guidance:"4 si compris et confirmé clairement ; dégrader si explication peu claire mais comprise après clarification. FG si le prospect n’en est pas conscient." },
  { id:22, criterion:"Étapes suivantes expliquées (liste de la grille actuelle)", grave:false, guidance:"4 si tous les éléments applicables sont expliqués ; dégrader selon nombre / importance des éléments omis ou imprécis. Inclure la mention du Code de conduite pour un client professionnel." },
  { id:23, criterion:"Écoute attentive des besoins et préoccupations", grave:false, guidance:"4 si écoute active et réponses adaptées ; dégrader selon interruptions, reformulations ou préoccupations ignorées." },
  { id:24, criterion:"Aucune déclaration négative sur concurrents ni information erronée", grave:false, guidance:"4 si aucune ; 3/2 si imprécision immédiatement corrigée sans effet ; 1 si propos négatif ou erreur importante ; 0 si propos négatif et/ou information erronée non corrigée. Conserver tout seuil « faute grave » uniquement s’il existe dans la règle MEGA applicable." },
  { id:25, criterion:"Plus de cinq objections : clôture de l’appel", grave:false, conditional:"N/A si le prospect n’a pas formulé plus de cinq objections.", guidance:"Si plus de cinq objections : 4 si clôture appropriée ; dégrader si tardive ou mal amenée ; 0 si l’appel se poursuit. Si le seuil n’est pas atteint : N/A." },
] as const;
export type QualityQuestion = typeof MEGA_QUALITY_QUESTIONS[number];
export const QUALITY_RUBRICS = {
  mega_call_v1:{key:'mega_call_v1',label:'Appels MEGA',questions:MEGA_QUALITY_QUESTIONS,conditionRules:[{questionId:14,field:'q14_consumption_available',naWhen:true},{questionId:25,field:'q25_more_than_five_objections',naWhen:false}] as const},
} as const;
export type QualityRubricKey=keyof typeof QUALITY_RUBRICS;

export const MEGA_QUALITY_SCALE = [
  [4,"Conforme et complet"],[3,"Conforme avec un détail mineur"],[2,"Partiellement conforme"],[1,"Très insuffisant"],[0,"Non réalisé ou non conforme"],
] as const;

export type QualityScoreRow = { id:string; activity_name:string; agent_name:string; sale_reference:string; score_percent:number };
export function aggregateQualityScores<T extends QualityScoreRow>(rows:T[]) {
  const key=(value:string)=>value.trim().toLocaleLowerCase('fr-FR');
  const saleKey=(row:QualityScoreRow)=>`${key(row.activity_name)}::${key(row.sale_reference)}`;
  const agentKey=(row:QualityScoreRow)=>key(row.agent_name);
  const sums=new Map<string,{sum:number;count:number}>();
  for(const row of rows){const k=saleKey(row),v=sums.get(k)||{sum:0,count:0};v.sum+=Number(row.score_percent);v.count++;sums.set(k,v);}
  const saleScores=new Map([...sums].map(([k,v])=>[k,v.sum/v.count]));
  const agentSales=new Map<string,{label:string;sales:Map<string,number>}>();
  for(const row of rows){const agent=agentKey(row),sale=saleKey(row),entry=agentSales.get(agent)||{label:row.agent_name.trim(),sales:new Map<string,number>()};entry.sales.set(sale,saleScores.get(sale)||0);agentSales.set(agent,entry);}
  const agentScores=new Map([...agentSales].map(([agent,entry])=>[agent,[...entry.sales.values()].reduce((sum,value)=>sum+value,0)/entry.sales.size]));
  return {
    saleCount:saleScores.size,
    averageSaleScore:saleScores.size?[...saleScores.values()].reduce((sum,value)=>sum+value,0)/saleScores.size:null,
    averageAgentScore:agentScores.size?[...agentScores.values()].reduce((sum,value)=>sum+value,0)/agentScores.size:null,
    scoresFor:(row:T)=>({sale:saleScores.get(saleKey(row))??null,agent:agentScores.get(agentKey(row))??null}),
    agentSummaries:[...agentSales.values()].map(({label,sales})=>({agent:label,sales:sales.size,score:[...sales.values()].reduce((sum,value)=>sum+value,0)/sales.size})).sort((a,b)=>b.score-a.score),
  };
}

export function calculateQuality(answers: Record<string, QualityAnswer>, questions:readonly QualityQuestion[]=MEGA_QUALITY_QUESTIONS) {
  // Une faute grave reste un critère applicable, mais sa note demeure null ;
  // seul N/A retire un critère du dénominateur défini par la grille.
  const applicable = questions.filter(q => answers[String(q.id)]?.kind !== "na");
  const sum = applicable.reduce((total,q) => total + (answers[String(q.id)]?.score ?? 0),0);
  const percentage = applicable.length ? (sum / (4 * applicable.length)) * 100 : null;
  const graveFaults = questions.filter(q => q.grave && answers[String(q.id)]?.kind === "grave").map(q => ({ question_id:q.id, criterion:q.criterion, comment:answers[String(q.id)]?.comment ?? "" }));
  const status: QualityStatus | null = graveFaults.length ? "Non conforme — faute grave" : percentage === null ? null : percentage >= 90 ? "Conforme" : percentage >= 75 ? "À consolider" : "Insuffisant";
  return { score_sum:sum, applicable_count:applicable.length, score_percent:percentage, status, grave_faults:graveFaults };
}

export function validateQualityAnswers(value: unknown, questions:readonly QualityQuestion[]=MEGA_QUALITY_QUESTIONS, naQuestionIds:readonly number[]=[14,25]): value is Record<string, QualityAnswer> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const answers=value as Record<string, QualityAnswer>;
  for (const q of questions) {
    const raw=answers[String(q.id)];
    if (!raw || typeof raw!=="object" || Array.isArray(raw)) return false;
    const a=raw as QualityAnswer;
    if (!["score","grave","na"].includes(a.kind) || typeof a.comment!=="string" || typeof a.reason!=="string" || a.comment.length>3000 || a.reason.length>2000) return false;
    if (a.kind === "grave") { if (!q.grave || a.score !== null || !a.comment?.trim()) return false; }
    else if (a.kind === "na") { if (!naQuestionIds.includes(q.id) || a.score !== null || !a.reason?.trim()) return false; }
    else if (!Number.isInteger(a.score) || a.score! < 0 || a.score! > 4) return false;
  }
  return Object.keys(answers).every(key => questions.some(q => String(q.id)===key));
}
