interface Params {
	/** e.g. `test` or `[api] test-coverage`. */
	label: string;
}

export const describeGateCrash = ({ label }: Params): string =>
	`${label} crashed: on every attempt Jest died without reporting a failing test, so this gate never returned a verdict.`;
