import assert from 'node:assert/strict';
import { balancedQualityQueue } from '../src/lib/quality-queue.ts';

const sale=(key,agent,centre,registered_date='2026-11-01')=>({key,agent,centre,registered_date});
const sales=[
 sale('a1','Alice','Centre A'),sale('a2','Alice','Centre A','2026-11-02'),
 sale('b1','Bob','Centre A'),sale('b2','Bob','Centre A'),
 sale('c1','Alice','Centre B'),
];
const reviews=[
 {agent_name:'Alice',agent_centre:'Centre A',sale_key:'old-a',sale_reference:'old-a',reviewed_at:'2026-11-05T10:00:00Z'},
 {agent_name:'Alice',agent_centre:'Centre A',sale_key:'older',sale_reference:'older',reviewed_at:'2026-09-01T10:00:00Z'},
];
const result=balancedQualityQueue(sales,reviews,sales,new Date('2026-11-06T10:00:00Z'));
assert.equal(result.completedFor(sales[0]),1);
assert.equal(result.completedFor(sales[4]),0);
assert.deepEqual(result.ordered.map(s=>s.key),['b1','c1','a1','b2','a2']);
assert.equal(result.agentCount,3);
console.log('PASS: équilibrage par agent et centre, contrôles des 30 derniers jours, répartition successive.');
