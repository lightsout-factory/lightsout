import { createServerFn } from '@tanstack/react-start';
import type { Issue } from '../common/types/Issue.ts';

export const findIssues = createServerFn({ method: 'GET' }).handler(async (): Promise<Issue[]> => [{ id: 1, title: 'Login fails' }]);
