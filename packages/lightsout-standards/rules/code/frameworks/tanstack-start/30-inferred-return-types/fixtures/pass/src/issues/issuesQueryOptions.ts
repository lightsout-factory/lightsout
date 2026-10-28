import { queryOptions } from '@tanstack/react-query';
import { findIssues } from './server/findIssues.ts';

// Correct: inference keeps the key and the data type exactly as declared.
export const issuesQueryOptions = () =>
	queryOptions({
		queryKey: ['issues'],
		queryFn: () => findIssues(),
	});
