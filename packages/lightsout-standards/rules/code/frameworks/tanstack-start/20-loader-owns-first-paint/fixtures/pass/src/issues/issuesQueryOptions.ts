import { queryOptions } from '@tanstack/react-query';
import { findIssues } from './server/findIssues.ts';

export const issuesQueryOptions = () =>
	queryOptions({
		queryKey: ['issues'],
		queryFn: () => findIssues(),
	});
