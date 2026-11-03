import { queryOptions } from '@tanstack/react-query';
import { findIssues } from '../server/findIssues.ts';

// The query the route prefetches and the screen reads, in the folder the framework adds for it.
export const issuesQueryOptions = () =>
	queryOptions({
		queryKey: ['issues'],
		queryFn: () => findIssues(),
	});
