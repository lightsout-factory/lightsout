import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/server/getReader.ts';

export const listRunsServerFn = createServerFn({ method: 'GET' }).handler(async () => getReader().listRuns());
