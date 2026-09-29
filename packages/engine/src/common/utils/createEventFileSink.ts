import { appendFile } from 'node:fs/promises';

interface Params {
	/** File the events are appended to, one JSON line per event. A promise for callers whose file name is only known once a directory has been resolved. */
	path: string | Promise<string>;
	/** Work that must finish before the first append — typically creating the directory. */
	ready?: Promise<unknown>;
}

/**
 * The sink returns synchronously because a driver's read loop calls it inline,
 * so appends chain through a promise tail to keep events in order. Failures,
 * including a rejected `ready`, are swallowed: evidence is best-effort and must
 * never fail or wedge a run.
 */
export const createEventFileSink = ({ path, ready }: Params): ((event: unknown) => void) => {
	let tail: Promise<unknown> = ready ? ready.catch(() => undefined) : Promise.resolve();

	return (event: unknown) => {
		tail = tail.then(async () => appendFile(await path, `${JSON.stringify(event)}\n`, 'utf8')).catch(() => undefined);
	};
};
