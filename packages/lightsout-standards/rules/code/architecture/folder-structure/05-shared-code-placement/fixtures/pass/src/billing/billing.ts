import { formatMoney } from '../common/utils/formatMoney.ts';
import { roundCents } from './common/utils/roundCents.ts';

export const billing = ({ cents }: { cents: number }): string => formatMoney({ cents: roundCents({ cents }) });
