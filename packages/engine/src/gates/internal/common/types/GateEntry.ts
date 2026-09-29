export interface GateEntry {
	/** The gate's family: the key `failedFamilies` reports and the `kind` the runner records — 'check', 'test', 'testCoverage', 'build', or a custom suite's own name. */
	family: string;
	/** The config's own spelling, used in the failure text and matched against a `gate-overrides` list: 'check', 'test', 'test-coverage', 'build', 'test-e2e', … */
	name: string;
	/** For a scoped group, still the `{package}` template until `runPackageGates` resolves it. */
	command: string;
}
