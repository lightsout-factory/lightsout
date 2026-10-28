import { createServerFn } from '@tanstack/react-start';
import type { Issue } from '../common/types/Issue.ts';

export const findOneIssue = createServerFn({ method: 'GET' })
	.inputValidator((data: { issueId: number }) => data)
	.handler(async ({ data }): Promise<Issue> => ({ id: data.issueId, title: 'Login fails', summary: 'The form posts twice.' }));
