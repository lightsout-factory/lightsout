interface Params {
	code: number;
}

/**
 * `process.exit` discards whatever a pipe has not accepted yet, so a slow reader
 * would get truncated output. Write callbacks fire in order, so the empty
 * write's callback runs only once everything queued before it was accepted.
 */
export const exitCli = async ({ code }: Params): Promise<never> => {
	await Promise.all([process.stdout, process.stderr].map((stream) => new Promise<void>((resolve) => stream.write('', () => resolve()))));

	return process.exit(code);
};
