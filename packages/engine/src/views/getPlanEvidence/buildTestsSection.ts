import { join } from 'node:path';
import { readJsonlRecords } from '#src/common/json/readJsonlRecords.ts';
import { TestReviewRecord } from '#src/contracts/run/TestReviewRecord.ts';
import { EvidenceSectionState } from '#src/contracts/views/planEvidence/EvidenceSectionState.ts';
import type { PlanEvidence } from '#src/contracts/views/planEvidence/PlanEvidence.ts';
import { readTestResults } from '#src/gates/testResults/common/readTestResults.ts';
import { testResultsDir } from '#src/gates/testResults/testResultsDir.ts';
import { measuredCount } from '#src/views/common/measuredCount.ts';
import { reportedCount } from '#src/views/getPlanEvidence/common/reportedCount.ts';
import type { BuildRun } from '#src/views/getPlanEvidence/common/types/BuildRun.ts';

interface Params {
	/** The view's cwd; handed to `readTestResults` for its repo-relative paths. */
	cwd: string;
	runs: BuildRun[];
	/** The build run is running, pending or paused. */
	going: boolean;
}

/** One step of one run whose gate executions recorded results, and the group and kind pairs it executed. */
interface Checkpoint {
	runId: string;
	step: string;
	pairs: { group: string; kind: string }[];
}

const checkpointOf = ({ run, step }: { run: BuildRun; step: string }): Checkpoint => ({
	runId: run.manifest.runId,
	step,
	pairs: run.summary.testResultExecutions.filter((execution) => execution.step === step).map(({ group, kind }) => ({ group, kind })),
});

/** The distinct tests one gate execution answered, keyed by file and full name, because results are recorded per file. */
const readTestKeys = async ({ cwd, checkpoint, group, kind }: { cwd: string; checkpoint: Checkpoint; group: string; kind: string }) => {
	const dir = await testResultsDir({ cwd, runId: checkpoint.runId, step: checkpoint.step, group, kind });
	const files = await readTestResults({ cwd, dir });

	return new Set(files.flatMap((file) => file.assertionResults.map((assertion) => JSON.stringify([file.testFilePath, assertion.fullName]))));
};

/**
 * Only the group and kind pairs both checkpoints executed are compared, because a results
 * directory exists per step, group and kind, so two arbitrary directories measure different packages.
 */
const countTests = async ({ cwd, runs }: { cwd: string; runs: BuildRun[] }) => {
	const recorded = runs.filter((run) => run.summary.testResultExecutions.length > 0);
	const earliest = recorded.at(0);
	const latest = recorded.at(-1);
	const firstStep = earliest?.summary.testResultExecutions.at(0)?.step;
	const lastStep = latest?.summary.testResultExecutions.at(-1)?.step;

	if (earliest === undefined || latest === undefined || firstStep === undefined || lastStep === undefined || (earliest === latest && firstStep === lastStep)) {
		return undefined;
	}

	const first = checkpointOf({ run: earliest, step: firstStep });
	const last = checkpointOf({ run: latest, step: lastStep });
	const shared = first.pairs.filter((pair) => last.pairs.some((other) => other.group === pair.group && other.kind === pair.kind));
	const before = new Set<string>();
	const after = new Set<string>();
	let answeredAtBoth = false;

	for (const { group, kind } of shared) {
		const beforeKeys = await readTestKeys({ cwd, checkpoint: first, group, kind });
		const afterKeys = await readTestKeys({ cwd, checkpoint: last, group, kind });

		answeredAtBoth ||= beforeKeys.size > 0 && afterKeys.size > 0;

		for (const key of beforeKeys) {
			before.add(key);
		}

		for (const key of afterKeys) {
			after.add(key);
		}
	}

	return answeredAtBoth ? { before: measuredCount({ value: before.size }), after: measuredCount({ value: after.size }) } : undefined;
};

/**
 * The manifest's acceptance-test list is filled only by the step that writes those tests, so a
 * non-empty list is the record that they were written. Absent when the family recorded no
 * acceptance test, no review and no test count.
 */
export const buildTestsSection = async ({ cwd, runs, going }: Params): Promise<PlanEvidence['tests']> => {
	const acceptanceTests = runs.reduce((total, run) => total + run.manifest.acceptanceTests.length, 0);
	const reviewLogs = await Promise.all(runs.map((run) => readJsonlRecords({ path: join(run.runDir, 'test-reviews.jsonl'), schema: TestReviewRecord })));
	const reviews = reviewLogs.flat();
	const testCount = await countTests({ cwd, runs });

	if (acceptanceTests === 0 && reviews.length === 0 && testCount === undefined) {
		return undefined;
	}

	return {
		state: going ? EvidenceSectionState.InProgress : EvidenceSectionState.Finished,
		...(acceptanceTests === 0 ? {} : { acceptanceTests: measuredCount({ value: acceptanceTests }) }),
		...(reviews.length === 0
			? {}
			: {
					reviewedFiles: reportedCount({ value: reviews.reduce((total, review) => total + review.verdicts.length, 0) }),
					rejections: reportedCount({ value: reviews.reduce((total, review) => total + review.rejections.length, 0) }),
				}),
		...(testCount === undefined ? {} : { testCount }),
	};
};
