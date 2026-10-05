interface Params {
	/** The filesystem error's own message, so the reader sees the code and path the platform reported. */
	failure: string;
}

/**
 * Separate from the timeout sentence: no run holds this machine, so telling the
 * reader to wait would send them after a holder that does not exist.
 */
export const describeGateLockFailure = ({ failure }: Params): string =>
	`gates never started: the shared gate reservation in this repository's primary checkout could not be created or read (${failure}). No gate command executed, so nothing here is evidence about the code. Fix the permissions on that .lightsout folder, or free the disk, and start the run again.`;
