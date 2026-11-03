import { createServerFn } from '@tanstack/react-start';
import type { Issue } from '../types/Issue.ts';

// The feature's one server function, in the folder the framework adds for it.
export const findIssues = createServerFn({ method: 'GET' }).handler(async (): Promise<Issue[]> => [{ id: 1, title: 'Login fails' }]);
