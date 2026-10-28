import { queryOptions, type UseQueryOptions } from '@tanstack/react-query';
import type { Issue } from './common/types/Issue.ts';
import { findIssues } from './server/findIssues.ts';

// Incorrect: the written type flattens what queryOptions() infers — the key's
// literal type is gone, so a loader and a screen no longer share one key type.
export const issuesQueryOptions = (): UseQueryOptions<Issue[], Error, Issue[], string[]> =>
	queryOptions({
		queryKey: ['issues'],
		queryFn: () => findIssues(),
	});
