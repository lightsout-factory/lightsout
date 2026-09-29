import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/lightsout/getReader.ts';

export const listPlanWorkspacesServerFn = createServerFn({ method: 'GET' }).handler(async () => getReader().listPlanWorkspaces());
