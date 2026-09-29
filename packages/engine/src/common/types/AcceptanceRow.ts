/**
 * Three fields and no more, so the plan's ledger rows and the manifest's
 * acceptance-test records both satisfy it without a conversion.
 */
export interface AcceptanceRow {
	/** Repo-relative path of the test file stating the criterion. */
	testFile: string;
	/** The test's title, as the file states it and as the runner reports it. */
	testName: string;
	/** The config's own gate key whose execution must carry the result. */
	gate: string;
}
