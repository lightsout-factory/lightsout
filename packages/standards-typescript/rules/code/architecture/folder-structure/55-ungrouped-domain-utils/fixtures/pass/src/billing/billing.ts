import { formatCurrency } from './common/formatting/formatCurrency.ts';
import { formatDate } from './common/formatting/formatDate.ts';
import { isWeekend } from './common/utils/isWeekend.ts';

export const billing = ({ cents, date }: { cents: number; date: Date }): string =>
	isWeekend({ date }) ? 'closed' : `${formatCurrency({ cents })} on ${formatDate({ date })}`;
