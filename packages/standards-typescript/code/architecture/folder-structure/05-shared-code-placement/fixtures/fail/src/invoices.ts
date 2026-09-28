import { formatMoney } from './billing/common/utils/formatMoney.ts';

// Reaches into billing's own common/ for a helper they both need.
export const invoices = ({ cents }: { cents: number }): string => `Invoiced ${formatMoney({ cents })}`;
