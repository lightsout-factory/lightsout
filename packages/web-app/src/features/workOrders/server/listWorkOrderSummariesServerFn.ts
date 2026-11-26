import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/server/getReader.ts';

/** Every work order the open repo holds, newest first; refused on the public site by the reader. */
export const listWorkOrderSummariesServerFn = createServerFn({ method: 'GET' }).handler(async () => getReader().listWorkOrderSummaries());
