import { ConfigNotFoundError } from '@lightsout/engine';
import { notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/lightsout/getReader.ts';

/**
 * The missing file becomes a 404 here, on the server, because the engine's
 * error class does not survive the server-function wire. A config that will not
 * parse travels as itself, so the error boundary can say which key is wrong.
 */
export const getConfigServerFn = createServerFn({ method: 'GET' }).handler(async () => {
	try {
		return await getReader().getConfig();
	} catch (error) {
		if (error instanceof ConfigNotFoundError) {
			throw notFound();
		}

		throw error;
	}
});
