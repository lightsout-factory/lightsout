import { formatDate } from './common/formatting/formatDate.ts';
import { parseDate } from './common/parsing/parseDate.ts';
import { parseTime } from './common/parsing/parseTime.ts';

export const billing = ({ day, time }: { day: string; time: string }): string => `${formatDate({ date: parseDate({ text: day }) })} +${parseTime({ text: time })}m`;
