import { createServerFn } from '@tanstack/react-start';
import type { Issue } from '../common/types/Issue.ts';

// Correct: the one place in the feature that runs on the server.
export const findIssues = createServerFn({ method: 'GET' }).handler(async (): Promise<Issue[]> => [{ id: 1, title: 'Login fails' }]);
