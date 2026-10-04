import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Driver } from '#src/common/types/Driver.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { withTestChangeReview } from '#tests/helpers/withTestChangeReview.ts';

interface AttributionDriverParams {
	dir: string;
	/** Repo-relative test file the writer plants. */
	testFile: string;
	/** The run's own edits; answers the repo-relative paths it reports. */
	implement: () => string[];
	/** Collects every prompt the cleanup executor was handed. */
	refactorPrompts: string[];
	onReview?: () => void;
	/** Answers one cleanup round, by its 1-based number. The default declines every round. */
	onRefactor?: (params: { pass: number }) => string;
}

/**
 * A stub agent for the standards-gate fixtures. The reviewer and the test writer
 * answer identically in all of them, so a fixture states only its own two
 * turns: the edits the run makes, and what each cleanup round does. Left to its
 * default that round declines, so whatever qualified as work has to still be
 * standing when cleanup ends.
 */
export const attributionDriver = ({ dir, testFile, implement, refactorPrompts, onReview, onRefactor = () => report() }: AttributionDriverParams): Driver => ({
	name: 'stub',
	invoke: withTestChangeReview({
		invoke: async ({ prompt }) => {
			const role = roleOf(prompt);

			if (role === 'standards-review') {
				onReview?.();

				return { text: reviewReport(), exitCode: 0 };
			}

			if (role === 'write-tests') {
				mkdirSync(join(dir, dirname(testFile)), { recursive: true });
				writeFileSync(join(dir, testFile), '// stub\n');

				return { text: report({ changedFiles: [{ path: testFile, summary: 'tests' }] }), exitCode: 0 };
			}

			if (role === 'refactor') {
				refactorPrompts.push(prompt);

				return { text: onRefactor({ pass: refactorPrompts.length }), exitCode: 0 };
			}

			return { text: report({ changedFiles: implement().map((path) => ({ path, summary: 'feature' })) }), exitCode: 0 };
		},
	}),
});
