import { queryOptions } from '@tanstack/react-query';
import { getPlanServerFn } from '#src/runDetail/server/getPlanServerFn.ts';

interface Params {
	/** Repo-relative plan path, exactly as the manifest recorded it. */
	path: string;
}

/** Never stale: a plan file does not change under a run that has already read it. */
export const planQueryOptions = ({ path }: Params) =>
	queryOptions({
		queryKey: ['plan', path],
		queryFn: () => getPlanServerFn({ data: { path } }),
		staleTime: Number.POSITIVE_INFINITY,
	});
