import assert from 'node:assert/strict';
import { aggregateQualityScores } from '../src/lib/quality.ts';

const review=(id,centre,agent,sale,score)=>({id,activity_name:'MEGA',agent_name:agent,agent_centre:centre,sale_reference:sale,score_percent:score});
const scores=aggregateQualityScores([
 review('1','TILIRA','sihambennani','A',80),
 review('2','TILIRA','sihambennani','A',100),
 review('3','TILIRA','sihambennani','B',70),
 review('4','Cimsourse','sihambennani','C',40),
]);
assert.equal(scores.agentSummaries.length,2);
assert.deepEqual(scores.agentSummaries.map(a=>[a.centre,a.sales,a.score]),[['TILIRA',2,80],['Cimsourse',1,40]]);
console.log('PASS: un score par vendeur et centre, une vente comptée une fois malgré deux contrôles.');
