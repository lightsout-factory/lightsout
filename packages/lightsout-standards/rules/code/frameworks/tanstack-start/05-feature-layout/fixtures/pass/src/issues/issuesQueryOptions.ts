import { queryOptions } from '@tanstack/react-query';
import { findIssues } from './server/findIssues.ts';

// Correct: used by the route loader and the screen, so it sits at the feature's
// top level, and its name says what it is.
export const issuesQueryOptions = () =>
	queryOptions({
		queryKey: ['issues'],
		queryFn: () => findIssues(),
	});
