interface Params {
	cwd: string;
	/** The live run's id — the only parameter the command takes, since everything else is read from that run's manifest. */
	runId: string;
}

/**
 * `process.argv[1]` is the running CLI bundle, so the agent resolves the identical engine
 * rather than whatever is installed. `cwd` is quoted because it may contain spaces; the
 * prefix stays unquoted because the harness's allowed-tools rule is a literal prefix match.
 */
export const buildSelfCheckCommand = ({ cwd, runId }: Params): { prefix: string; command: string } => {
	const prefix = `node ${process.argv[1]} self-check`;

	return { prefix, command: `${prefix} --run ${runId} --cwd "${cwd}"` };
};
