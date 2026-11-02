import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/common/server/getReader/getReader.ts';

/** No argument: the run detail's own tab narrows friction to one run from the run view it holds. */
export const getFrictionServerFn = createServerFn({ method: 'GET' }).handler(async () => getReader().getFriction());
