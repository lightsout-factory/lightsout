import { roundCents } from '../common/utils/roundCents.ts';
import { formatMoney } from './common/utils/formatMoney.ts';

export const billing = ({ cents }: { cents: number }): string => formatMoney({ cents: roundCents({ cents }) });
