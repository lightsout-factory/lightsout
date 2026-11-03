import { RunNotFoundError } from '@lightsout/engine';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { toRunDetailView } from '#src/features/runs/server/toRunDetailView.ts';
import { getReader } from '#src/server/getReader.ts';
import { readOrNotFound } from '#src/server/readOrNotFound.ts';

export const getRunServerFn = createServerFn({ method: 'GET' })
	.inputValidator(z.object({ runId: z.string().min(1) }))
	.handler(({ data }) =>
		readOrNotFound({ read: async () => toRunDetailView({ view: await getReader().getRun({ runId: data.runId }) }), absent: [RunNotFoundError] }),
	);
