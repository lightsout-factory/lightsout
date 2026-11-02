import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/common/server/getReader/getReader.ts';

export const listPlanWorkspacesServerFn = createServerFn({ method: 'GET' }).handler(async () => getReader().listPlanWorkspaces());
