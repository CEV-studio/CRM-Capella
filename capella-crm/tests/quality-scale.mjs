import assert from 'node:assert/strict';
import { calculateQuality,validateQualityAnswers,MEGA_QUALITY_QUESTIONS,MEGA_QUALITY_QUESTIONS_V1 } from '../src/lib/quality.ts';

assert.equal(MEGA_QUALITY_QUESTIONS.length,18);
assert.deepEqual(MEGA_QUALITY_QUESTIONS.map(q=>q.criterion),MEGA_QUALITY_QUESTIONS_V1.map(q=>q.criterion));
const answer=(score)=>({kind:'score',score,comment:'',reason:''});
const all=(score)=>Object.fromEntries(MEGA_QUALITY_QUESTIONS.map(q=>[q.id,answer(score)]));
assert.equal(calculateQuality(all(5)).score_percent,100);
assert.equal(calculateQuality(all(0)).status,'Insuffisant');
assert.equal(validateQualityAnswers(all(5)),true);
assert.equal(validateQualityAnswers(all(6)),false);
const grave=all(5);grave['8']={kind:'grave',score:null,comment:'test',reason:''};
assert.equal(validateQualityAnswers(grave),false);
const partial=all(5);partial['14']={kind:'na',score:null,comment:'',reason:'Consommation disponible'};
assert.equal(validateQualityAnswers(partial),true);
assert.equal(calculateQuality(partial).applicable_count,17);
assert.equal(calculateQuality(partial).score_percent,100);
console.log('PASS: barème 0–5, critères conservés, N/A exclu, faute grave refusée.');
