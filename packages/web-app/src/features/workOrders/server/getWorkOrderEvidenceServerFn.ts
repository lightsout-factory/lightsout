import { notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getReader } from '#src/server/getReader.ts';

/**
 * A name no work-order folder holds becomes `notFound()` here, on the server,
 * so the page answers it as the router answers any address that leads nowhere.
 */
export const getWorkOrderEvidenceServerFn = createServerFn({ method: 'GET' })
	.inputValidator(z.object({ name: z.string().min(1) }))
	.handler(async ({ data }) => {
		const totals = await getReader().getWorkOrderEvidence({ name: data.name });

		if (totals === undefined) {
			throw notFound();
		}

		return totals;
	});
