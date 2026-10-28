import { createServerFn } from '@tanstack/react-start';
import type { Issue } from '../common/types/Issue.ts';

// Correct: input is declared before the handler reads it.
export const closeIssue = createServerFn({ method: 'POST' })
	.inputValidator((data: { issueId: number }) => data)
	.handler(async ({ data }): Promise<Issue> => ({ id: data.issueId, title: 'Login fails' }));
