interface Params {
	/** The config's own gate key, as an acceptance-test row carries it: 'test', 'test-coverage', 'test-e2e'. */
	gate: string;
	/** The gate family a result records: 'check', 'test', 'testCoverage', 'build', or a custom suite's own name. */
	kind: string;
}

/**
 * A row naming `test` is satisfied by the coverage gate too, because the schedule substitutes
 * the instrumented gate for the plain one and it runs the same suite.
 */
export const satisfiesGateKey = ({ gate, kind }: Params): boolean => {
	if (gate === 'test') {
		return kind === 'test' || kind === 'testCoverage';
	}

	return gate === 'test-coverage' ? kind === 'testCoverage' : kind === gate;
};
