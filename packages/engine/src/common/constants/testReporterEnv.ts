export const testReporterEnv = {
	/** Absolute path of the reporter file the engine wrote into the run folder. */
	reporter: 'LIGHTSOUT_JEST_REPORTER',
	/** Directory this gate execution's per-test results go in. */
	resultsDir: 'LIGHTSOUT_TEST_RESULTS_DIR',
} as const;
