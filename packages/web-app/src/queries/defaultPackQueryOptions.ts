import { queryOptions } from '@tanstack/react-query';
import { getDefaultPackServerFn } from '#src/server/getDefaultPackServerFn.ts';

/** Never stale: it is bundled into the app and cannot change while it runs. */
export const defaultPackQueryOptions = () =>
	queryOptions({
		queryKey: ['defaultPack'],
		queryFn: () => getDefaultPackServerFn(),
		staleTime: Number.POSITIVE_INFINITY,
	});
