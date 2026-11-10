import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui';
import { euros, type Contract, type Statement, type CycleTracking, type SupplierBilling } from '@/lib/belgium/domain';
import { expectedCallDate, financialModel, monthlyProduction, shiftMonths } from '@/lib/belgium/finance';

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const utcDate = (date: string) => new Date(date + 'T00:00:00Z');

export function ProductionAccounting({ contracts, statements, tracking, billing, today, centre }: {
  contracts: Contract[];
  statements: Statement[];
  tracking: CycleTracking[];
  billing: SupplierBilling[];
  today: string;
  centre: string;
}) {
  const current = today.slice(0, 7) + '-01';
  const production = monthlyProduction(contracts, statements, tracking);
  const periods = [
    { period: shiftMonths(current, -1), label: 'Production précédente' },
    { period: current, label: 'Nouvelle production' },
  ];

  return <section aria-label="Comptabilité de la production par mois" className="grid gap-4 lg:grid-cols-2">
    {periods.map(({ period, label }) => {
      const year = Number(period.slice(0, 4));
      const month = Number(period.slice(5, 7));
      const model = financialModel(contracts, statements, tracking, billing, { view: 'month', year, month }, today);
      const cutoff = shiftMonths(period, 1).slice(0, 7) + '-14';
      const effective = production.find(row => row.period === period)?.active ?? 0;
      const href = '/comptabilite/belgique?' + new URLSearchParams({ tab: 'dashboard', view: 'month', year: String(year), month: String(month), centre });
      return <Card key={period}>
        <CardHeader title={label + ' · ' + monthFormat.format(utcDate(period))} action={<Link className="text-sm underline" href={href}>Détail du mois</Link>} />
        <div className="space-y-3 p-5">
          <p className="text-sm text-navy-600">
            {effective} effectifs rattachés · {today <= cutoff ? 'Ouverte jusqu’au' : 'Close le'} {dayFormat.format(utcDate(cutoff))} inclus
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm tabular-nums">
              <thead><tr className="border-b border-navy-100">
                <th scope="col" className="py-2 text-left">Montants</th>
                <th scope="col" className="px-2 py-2">Brut MEGA</th>
                <th scope="col" className="px-2 py-2">Part centre</th>
                <th scope="col" className="py-2">Part Capella</th>
              </tr></thead>
              <tbody>
                <tr className="border-b border-navy-100">
                  <th scope="row" className="py-2 text-left font-medium">Prévisionnel</th>
                  <td className="px-2">{euros(model.forecastGross)}</td>
                  <td className="px-2">{euros(model.forecastCentre)}</td>
                  <td>{euros(model.forecastCapella)}</td>
                </tr>
                <tr>
                  <th scope="row" className="py-2 text-left font-medium">Validé par MEGA</th>
                  <td className="px-2">{euros(model.validatedGross)}</td>
                  <td className="px-2">{euros(model.validatedCentre)}</td>
                  <td>{euros(model.validatedCapella)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-navy-600">Appel à facturation prévu le {dayFormat.format(utcDate(expectedCallDate(period)))}</p>
        </div>
      </Card>;
    })}
  </section>;
}
