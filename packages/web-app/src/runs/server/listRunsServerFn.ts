import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/common/server/getReader/getReader.ts';

export const listRunsServerFn = createServerFn({ method: 'GET' }).handler(async () => getReader().listRuns());
