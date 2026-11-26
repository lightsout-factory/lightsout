import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/server/getReader.ts';

/** The open repo's latest queue drain; refused on the public site by the reader. */
export const getQueueViewServerFn = createServerFn({ method: 'GET' }).handler(async () => getReader().getQueueView());
