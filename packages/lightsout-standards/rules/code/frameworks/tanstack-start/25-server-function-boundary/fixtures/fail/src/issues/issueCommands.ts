import { createServerFn } from '@tanstack/react-start';
import type { Issue } from './common/types/Issue.ts';

// Incorrect: two server functions in one file, outside server/, and the update
// takes input it never validates.
export const findOneIssue = createServerFn({ method: 'GET' }).handler(async (): Promise<Issue> => ({ id: 1, title: 'Login fails' }));

export const closeIssue = createServerFn({ method: 'POST' }).handler(async ({ data }): Promise<Issue> => ({ id: Number(data), title: 'Login fails' }));
