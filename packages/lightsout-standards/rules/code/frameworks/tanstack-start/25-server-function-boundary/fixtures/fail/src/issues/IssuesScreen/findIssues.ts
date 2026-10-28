import { createServerFn } from '@tanstack/react-start';
import type { Issue } from '../common/types/Issue.ts';

// Incorrect: a server function beside the screen, so nothing in the tree says
// where the client stops and the server begins.
export const findIssues = createServerFn({ method: 'GET' }).handler(async (): Promise<Issue[]> => [{ id: 1, title: 'Login fails' }]);
