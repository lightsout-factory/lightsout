import { formatMoney } from '../../common/formatMoney.ts';
import { buildReceipt } from './buildReceipt.ts';
import { roundCents } from './common/roundCents.ts';

export const chargeCustomer = ({ cents }: { cents: number }): string => `${buildReceipt({ cents })} ${formatMoney({ cents: roundCents({ cents }) })}`;
