import { norm, type Contract } from './domain';

// Supplier statuses define these categories; activation alone never proves payment.
export function cancellationStats(contracts:Contract[]){
 return {
  cancelled:contracts.filter(c=>norm(c.status).startsWith('annule')&&norm(c.status).includes('parleclient')),
  terminated:contracts.filter(c=>['contrattermine','termine'].includes(norm(c.status))),
 };
}
