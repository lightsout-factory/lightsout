import { testReporterEnv } from '#src/common/constants/testReporterEnv.ts';

/**
 * A string rather than a file the bundler copies, so the bundle carries it as text with no
 * second esbuild loader. It writes one file per jest process because a monorepo's
 * per-package jest processes all inherit the same results directory.
 */
export const jestReporterSource = `const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Records what each jest process actually ran, for the lightsout engine to read
 * back after the gate command exits. Inert wherever the engine's environment
 * variables are unset, which is every ordinary developer run.
 */
class LightsoutJestReporter {
	onRunComplete(contexts, results) {
		const dir = process.env['${testReporterEnv.resultsDir}'];

		if (!dir) {
			return;
		}

		try {
			mkdirSync(dir, { recursive: true });
			writeFileSync(
				join(dir, process.pid + '-' + Date.now() + '.json'),
				JSON.stringify({
					testResults: ((results && results.testResults) || []).map(function (file) {
						return {
							testFilePath: file.testFilePath,
							assertionResults: (file.testResults || []).map(function (assertion) {
								const result = {
									title: assertion.title,
									ancestorTitles: assertion.ancestorTitles || [],
									fullName: assertion.fullName,
									status: assertion.status,
								};

								if (typeof assertion.duration === 'number') {
									result.durationMs = assertion.duration;
								}

								return result;
							}),
						};
					}),
				}),
			);
		} catch {
			// Evidence is best-effort: a reporter that throws would fail a suite it
			// is only watching, and the engine already treats missing results as
			// missing evidence.
		}
	}
}

module.exports = LightsoutJestReporter;
`;
