import { formatMoney } from './common/utils/formatMoney.ts';

export const invoices = ({ cents }: { cents: number }): string => `Invoiced ${formatMoney({ cents })}`;
