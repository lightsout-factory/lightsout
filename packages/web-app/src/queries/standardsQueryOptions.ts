import { queryOptions } from '@tanstack/react-query';
import { getStandardsServerFn } from '#src/server/getStandardsServerFn.ts';

/** Not polled: it changes only when someone runs a check. */
export const standardsQueryOptions = () =>
	queryOptions({
		queryKey: ['standards'],
		queryFn: () => getStandardsServerFn(),
	});
