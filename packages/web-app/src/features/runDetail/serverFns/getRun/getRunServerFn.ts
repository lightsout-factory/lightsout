import { RunNotFoundError } from '@lightsout/engine';
import { notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { toRunDetailView } from '#src/features/runDetail/common/utils/toRunDetailView.ts';
import { getReader } from '#src/lightsout/getReader.ts';

/**
 * An unknown id becomes `notFound()` here on the server, because the engine's
 * error class does not survive the server-function wire.
 */
export const getRunServerFn = createServerFn({ method: 'GET' })
	.inputValidator(z.object({ runId: z.string().min(1) }))
	.handler(async ({ data }) => {
		try {
			return toRunDetailView({ view: await getReader().getRun({ runId: data.runId }) });
		} catch (error) {
			if (error instanceof RunNotFoundError) {
				throw notFound();
			}

			throw error;
		}
	});
