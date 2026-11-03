import { queryOptions } from '@tanstack/react-query';
import { getConfigServerFn } from '#src/server/getConfigServerFn.ts';

/** Not polled: it changes only when someone edits `lightsout.config.json`. */
export const configQueryOptions = () =>
	queryOptions({
		queryKey: ['config'],
		queryFn: () => getConfigServerFn(),
	});
