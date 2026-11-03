import { queryOptions } from '@tanstack/react-query';
import { getRepoRootServerFn } from '#src/server/getRepoRootServerFn.ts';

export const repoRootQueryOptions = () =>
	queryOptions({
		queryKey: ['repoRoot'],
		queryFn: () => getRepoRootServerFn(),
	});
