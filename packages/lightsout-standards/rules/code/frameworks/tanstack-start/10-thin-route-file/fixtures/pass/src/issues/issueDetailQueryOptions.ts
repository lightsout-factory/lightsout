import { queryOptions } from '@tanstack/react-query';
import { findOneIssue } from './server/findOneIssue.ts';

interface Params {
	issueId: number;
}

export const issueDetailQueryOptions = ({ issueId }: Params) =>
	queryOptions({
		queryKey: ['issues', issueId],
		queryFn: () => findOneIssue({ data: { issueId } }),
	});
