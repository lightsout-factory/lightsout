import { collectGateObservations } from '#src/common/collectGateObservations.ts';
import { resolveGateOverride } from '#src/common/config/resolveGateOverride.ts';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { resolveGateSchedule } from '#src/common/resolveGateSchedule.ts';
import type { AcceptanceRow } from '#src/common/types/AcceptanceRow.ts';
import { packageOf } from '#src/common/workspace/packageOf.ts';
import { resolveConsumerTypescript } from '#src/common/workspace/resolveConsumerTypescript.ts';
import type { GateResult } from '#src/contracts/gates/GateResult.ts';
import { checkChangedFilesExecuted } from '#src/coverage/checkChangedFilesExecuted.ts';
import { runGates } from '#src/gates/runGates/runGates.ts';
import { checkAcceptanceTests } from '#src/gates/testResults/checkAcceptanceTests.ts';
import type { VerificationResult } from '#src/pipeline/internal/common/types/VerificationResult.ts';
import { sourceFiles } from '#src/pipeline/internal/common/utils/sourceFiles.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';

const passedCoverage = ({ gate }: { gate: GateResult }) => gate.kind === 'testCoverage' && gate.skipped !== true && gate.exitCode === 0;

const changedFilesExecutedError = ({ run, packagesDir }: { run: PipelineRun; packagesDir: string }) => {
	const manifest = run.current();

	return checkChangedFilesExecuted({
		cwd: run.cwd,
		config: run.config,
		compiler: resolveConsumerTypescript({ cwd: run.cwd, packagesDir }),
		changedFiles: sourceFiles({ run }).filter((file) => !manifest.unreachableChangedFiles.includes(file)),
	});
};

interface Params {
	run: PipelineRun;
	/**
	 * Also run the coverage gate. On at clean-slate and every verify AFTER
	 * tests exist; off for verify-implement, where freshly written source has
	 * no tests yet and a coverage failure would not be the agent's fault.
	 */
	coverage?: boolean;
	/**
	 * The verification checkpoint in flight — 'clean-slate', 'verify-implement',
	 * 'verify-tests' or 'verify-refactor' — whose `gate-overrides` entry decides
	 * its gate schedule.
	 */
	checkpoint: string;
	/**
	 * The acceptance tests this checkpoint must prove, in the shape
	 * `checkAcceptanceTests` takes. Empty where the plan carries no ledger, and at
	 * clean-slate, where the ledger's tests have not been written yet.
	 */
	rows: AcceptanceRow[];
	/** True only at the run's last verification, where an acceptance test no gate proved is a failure rather than a skip. */
	final?: boolean;
	/**
	 * Whether a passed coverage gate is followed by the per-file check that every
	 * changed source file was executed. Default `true`; `false` only for a
	 * move-folders-and-files checkpoint, whose phase writes no tests.
	 */
	changedFilesExecuted?: boolean;
}

/**
 * The acceptance check runs before the per-file executed check because it
 * judges the gates that just ran, and a checkpoint that cannot prove its
 * acceptance tests gains nothing from also hearing which files went uncovered.
 * The per-file executed check is the one check the repo-wide threshold cannot
 * make; it follows whether the coverage gate actually ran and passed, not the
 * `coverage` argument, because an override may add or drop that gate.
 */
export const runVerificationGates = async ({ run, coverage, checkpoint, rows, final, changedFilesExecuted }: Params): Promise<VerificationResult> => {
	const packagesDir = run.config['packages-dir'] ?? defaultPackagesDir;
	const hasRootChanges = run.current().changedFiles.some((file) => packageOf({ file, packagesDir }) === undefined);
	const collector = collectGateObservations();

	const result = await runGates({
		cwd: run.cwd,
		config: run.config,
		coverage,
		packages: run.current().packages,
		includeRoot: hasRootChanges,
		failFast: false,
		schedule: resolveGateSchedule({ override: resolveGateOverride({ overrides: run.config['gate-overrides'], checkpoint }) }),
		runId: run.current().runId,
		step: run.current().currentStep ?? undefined,
		onGateResult: collector.onGateResult,
		onProgress: (message) => run.progress(message),
	});
	const gates = collector.observed();
	// A crashed or timed-out gate is red without being evidence, so it is kept
	// out of the failure list the step shows and the fix agent reads — even when
	// its family failed in another group — and `crashes` or `timeouts` is where
	// it is reported instead.
	const failures = gates.filter(
		(observation) =>
			observation.skipped !== true &&
			observation.crashed !== true &&
			observation.timedOut !== true &&
			observation.exitCode !== undefined &&
			observation.exitCode !== 0 &&
			result.failedFamilies.includes(observation.kind),
	);
	const coverageRan = gates.some((gate) => passedCoverage({ gate }));

	// The gates' own verdict unless a post-gate check overrules it. Held in one
	// place so `gates` — every observation, which both the acceptance check and
	// the clean-slate probe read back — is attached once at the end rather than
	// re-listed by each branch, where one branch eventually forgets it.
	let verdict: Omit<VerificationResult, 'gates'> = { ...result, failures };

	if (result.error === undefined) {
		const acceptanceError = await checkAcceptanceTests({
			cwd: run.cwd,
			rows,
			gates,
			final: final === true,
			packagesDir,
			onProgress: (message) => run.progress(message),
		});

		if (acceptanceError !== undefined) {
			verdict = { error: acceptanceError, failedFamilies: ['acceptance-tests'], crashes: [], timeouts: [], coordination: undefined, failures: [] };
		} else if (coverageRan && changedFilesExecuted !== false) {
			const executedError = await changedFilesExecutedError({ run, packagesDir });

			verdict =
				executedError === undefined
					? { error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined, failures: [] }
					: { error: executedError, failedFamilies: ['changed-files-executed'], crashes: [], timeouts: [], coordination: undefined, failures: [] };
		}
	}

	return { ...verdict, gates };
};
