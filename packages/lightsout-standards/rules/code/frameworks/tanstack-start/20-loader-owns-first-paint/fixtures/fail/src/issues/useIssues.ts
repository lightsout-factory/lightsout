import { useQuery } from '@tanstack/react-query';
import { issuesQueryOptions } from './issuesQueryOptions.ts';

// Incorrect: a hook whose whole body is the query call is a second name for it.
export const useIssues = () => useQuery(issuesQueryOptions());
