import { queryOptions } from '@tanstack/react-query';
import { getFrictionServerFn } from '#src/server/getFrictionServerFn.ts';

/** Not polled: the log grows only when a run records something. */
export const frictionQueryOptions = () =>
	queryOptions({
		queryKey: ['friction'],
		queryFn: () => getFrictionServerFn(),
	});
