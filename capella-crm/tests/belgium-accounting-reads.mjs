import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/belgium/server.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
let calls = [];
let admin = true;
const db = {
  from(table) {
    const call = {table, orders: [], filters: []};
    const query = {
      select(columns) { call.columns = columns; return query; },
      order(column) { call.orders.push(column); return query; },
      eq(column, value) { call.filters.push([column, value]); return query; },
      async range(start, end) {
        calls.push({...call, start, end});
        if (table === 'be_contracts' && start === 0)
          return {data: Array.from({length: 1000}, (_, key) => ({data: {key}}))};
        if (table === 'be_contracts' && start === 1000)
          return {data: [{data: {key: 1000}}]};
        if (table === 'be_statement_lines')
          return {data: [{data: {key: 1000, gross_cents: 6500}}]};
        return {data: []};
      },
    };
    return query;
  },
};
const mod = {exports: {}};
new Function('module', 'exports', 'require', js)(mod, mod.exports, name => ({
  'server-only': {},
  '@/lib/auth': {requireAdmin: async () => { if (!admin) throw new Error('denied'); }},
  '@/lib/supabase/server': {createClient: async () => db},
})[name]);
const {loadBelgium} = mod.exports;
const expected = {
  dashboard: ['be_contracts', 'be_statement_lines', 'be_cycle_tracking', 'be_supplier_billing'],
  ledger: ['be_contracts', 'be_statement_lines', 'be_invoices', 'be_cycle_tracking', 'be_supplier_billing', 'be_deductions'],
  contracts: ['be_contracts', 'be_statement_lines'],
  imports: ['be_imports'],
  cycles: ['be_contracts', 'be_statement_lines', 'be_cycle_tracking', 'be_supplier_billing'],
  billing: ['be_contracts', 'be_statement_lines', 'be_invoices', 'be_cycle_tracking', 'be_supplier_billing'],
  'import-preview': ['be_contracts', 'be_imports'],
  export: ['be_contracts', 'be_statement_lines'],
};
for (const [view, tables] of Object.entries(expected)) {
  calls = [];
  const data = await loadBelgium(view);
  assert.deepEqual([...new Set(calls.map(({table}) => table))].sort(), [...tables].sort(), view);
  if (tables.includes('be_contracts')) {
    assert.deepEqual(calls.filter(c => c.table === 'be_contracts').map(c => [c.columns, c.start, c.end]), [['data', 0, 999], ['data', 1000, 1999]]);
    assert.equal(data.contracts.at(-1).key, 1000);
  }
  if (tables.includes('be_statement_lines')) assert.equal(data.statements[0].gross_cents, 6500);
}
calls = [];
await loadBelgium('contracts', {contract: 'some-contract'});
assert.deepEqual(calls.find(c => c.table === 'be_cycle_tracking').filters, [['contract_key', 'some-contract']]);
calls = [];
await loadBelgium('imports', {contract: 'some-contract'});
assert.deepEqual(calls.map(c => c.table), ['be_imports']);
assert.deepEqual(calls[0].orders, ['created_at', 'id']);
calls = [];
admin = false;
await assert.rejects(() => loadBelgium('ledger'), /denied/);
assert.deepEqual(calls, []);
console.log('PASS: tab-specific reads, detail scoping, safe pagination, preserved amounts and admin guard.');
