import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/server/getReader.ts';

export const listPlanWorkspacesServerFn = createServerFn({ method: 'GET' }).handler(async () => getReader().listPlanWorkspaces());
