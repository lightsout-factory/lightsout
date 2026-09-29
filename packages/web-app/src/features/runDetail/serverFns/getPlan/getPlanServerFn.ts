import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getReader } from '#src/lightsout/getReader.ts';

/**
 * Only the path's shape is checked here: the engine's `getPlanDocument` refuses a
 * path that resolves outside the repo root.
 */
export const getPlanServerFn = createServerFn({ method: 'GET' })
	.inputValidator(z.object({ path: z.string().min(1) }))
	.handler(async ({ data }) => getReader().getPlan({ path: data.path }));
