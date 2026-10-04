import { buildReceipt } from './buildReceipt.ts';
import { formatMoney } from './common/formatMoney.ts';
import { roundCents } from './common/roundCents.ts';
import { taxRate } from './taxRate.ts';

export const chargeCustomer = ({ cents }: { cents: number }): string => `${buildReceipt({ cents })} ${formatMoney({ cents: roundCents({ cents }) * taxRate })}`;
