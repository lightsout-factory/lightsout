import { queryOptions } from '@tanstack/react-query';

// Incorrect: queries/ names a kind of code. The factory's own name already says
// what it is, and placement puts it at the feature's top level.
export const issuesQueryOptions = () =>
	queryOptions({
		queryKey: ['issues'],
		queryFn: async () => [{ id: 1, title: 'Login fails' }],
	});
