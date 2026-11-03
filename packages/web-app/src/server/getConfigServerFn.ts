import { ConfigNotFoundError } from '@lightsout/engine';
import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/server/getReader.ts';
import { readOrNotFound } from '#src/server/readOrNotFound.ts';

/** A config that will not parse travels as itself, so the error boundary can say which key is wrong; only its absence becomes a 404. */
export const getConfigServerFn = createServerFn({ method: 'GET' }).handler(() =>
	readOrNotFound({ read: () => getReader().getConfig(), absent: [ConfigNotFoundError] }),
);
