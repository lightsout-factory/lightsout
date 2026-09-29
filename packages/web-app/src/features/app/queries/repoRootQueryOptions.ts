import { queryOptions } from '@tanstack/react-query';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { getRepoRootServerFn } from '#src/features/app/serverFns/getRepoRoot/getRepoRootServerFn.ts';

export const repoRootQueryOptions = () =>
	queryOptions({
		queryKey: [QueryKey.RepoRoot],
		queryFn: () => getRepoRootServerFn(),
	});
