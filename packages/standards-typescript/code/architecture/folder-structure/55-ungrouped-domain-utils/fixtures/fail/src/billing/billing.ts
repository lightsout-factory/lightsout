import { formatCurrency } from './common/utils/formatCurrency.ts';
import { formatDate } from './common/utils/formatDate.ts';
import { isWeekend } from './common/utils/isWeekend.ts';

export const billing = ({ cents, date }: { cents: number; date: Date }): string =>
	isWeekend({ date }) ? 'closed' : `${formatCurrency({ cents })} on ${formatDate({ date })}`;
