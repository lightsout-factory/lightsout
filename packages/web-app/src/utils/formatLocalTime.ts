import { format } from 'date-fns';

interface Params {
	/** An ISO instant, as the engine records every time. */
	iso: string;
}

/** The reader's own clock, 24-hour, with the day spelled out so no locale can swap day and month. */
export const formatLocalTime = ({ iso }: Params): string => format(new Date(iso), 'd MMM yyyy, HH:mm');
