import { createServerFn } from '@tanstack/react-start';
import type { Issue } from '../common/types/Issue.ts';

// Correct: one server function, in server/, named for what it does.
export const findIssues = createServerFn({ method: 'GET' }).handler(async (): Promise<Issue[]> => [{ id: 1, title: 'Login fails' }]);
