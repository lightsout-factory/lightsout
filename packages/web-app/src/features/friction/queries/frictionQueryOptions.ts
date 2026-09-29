import { queryOptions } from '@tanstack/react-query';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { getFrictionServerFn } from '#src/features/friction/internal/serverFns/getFrictionServerFn.ts';

/** Not polled: the log grows only when a run records something. */
export const frictionQueryOptions = () =>
	queryOptions({
		queryKey: [QueryKey.Friction],
		queryFn: () => getFrictionServerFn(),
	});
