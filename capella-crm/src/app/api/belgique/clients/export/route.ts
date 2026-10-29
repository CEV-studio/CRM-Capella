import { loadBelgiumProduction } from '@/lib/belgium/server';
import { clientDirectory } from '@/lib/belgium/clients';

export const dynamic = 'force-dynamic';

function cell(value: unknown) {
  const valueText = String(value ?? '');
  // Spreadsheet applications must not evaluate imported client data as formulas.
  return `"${(/^[\s\u0000-\u001f]*[=+@-]/.test(valueText) ? "'" : '') + valueText.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  // The production RPC applies the same role and centre restrictions as the list.
  const { contracts } = await loadBelgiumProduction();
  const params = Object.fromEntries(new URL(request.url).searchParams) as Record<string, string>;
  const clients = clientDirectory(contracts, params);
  const headers = ['Client', 'Téléphone', 'Email', 'ID MEGA', 'Centre', 'Agent', 'Code agent', 'Fournisseur', 'Énergie', 'Produit', 'Référence contrat', 'EAN', 'Statut', 'Statut MEGA', 'Inscription', 'Effet observé', 'Mois de production', 'Dernier reporting'];
  const rows = clients.flatMap(client => client.contracts.map(contract => [
    client.name, client.phone, contract.email, contract.mega_id, contract.centre,
    contract.agent, contract.agent_reference, contract.supplier, contract.energy,
    contract.product_family || contract.product, contract.reference, contract.ean,
    contract.status_class, contract.status, contract.registered_date, contract.effect_date,
    contract.period?.slice(0, 7), contract.report_date,
  ]));
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(';')).join('\r\n');
  return new Response(csv, { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="base-clients-belgique.csv"',
    'Cache-Control': 'private, no-store',
  } });
}
