interface Params {
	/** e.g. `test` or `[api] test-e2e`. */
	label: string;
	ceilingMinutes: number;
}

/** Not the wait for the machine — that is `describeGateCoordinationTimeout`. */
export const describeGateTimeout = ({ label, ceilingMinutes }: Params): string =>
	`${label} timed out: every attempt ran past the ${ceilingMinutes}-minute gate ceiling (timeouts.gate-minutes), so this gate never returned a verdict.`;
