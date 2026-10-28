import { queryOptions } from '@tanstack/react-query';
import type { Issue } from './common/types/Issue.ts';

export const issuesQueryOptions = () =>
	queryOptions({
		queryKey: ['issues'],
		queryFn: async (): Promise<Issue[]> => [{ id: 1, title: 'Login fails' }],
	});
