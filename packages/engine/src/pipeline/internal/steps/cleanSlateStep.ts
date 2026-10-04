import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { messageOf } from '#src/common/messageOf.ts';
import { isGeneratedPath } from '#src/common/sourceFiles/isGeneratedPath.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { checkTestResultsCapability } from '#src/gates/testResults/checkTestResultsCapability.ts';
import { approveTestFiles } from '#src/pipeline/approvedTests/approveTestFiles.ts';
import { isTestSideFile } from '#src/pipeline/common/isTestSideFile.ts';
import { runVerificationGates } from '#src/pipeline/internal/common/utils/runVerificationGates.ts';
import { stopOnGateCoordination } from '#src/pipeline/internal/common/utils/stopOnGateCoordination.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/internal/PipelineStep.ts';
import { writeRunStandardsBaseline } from '#src/runState/standardsBaseline/writeRunStandardsBaseline.ts';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck.ts';

/**
 * The whole repository and `all` rather than the debt ledger's suppression,
 * because the comparison point has to be complete: a violation hidden today
 * must still read as inherited once the run's edits make it visible. `persist`
 * is off so a run never clobbers the user's own `lightsout standards-check`
 * report. A failure is recorded, never a gate: cleanup treats an absent
 * baseline as no comparison point.
 */
const captureStandardsBaseline = async ({ run }: { run: PipelineRun }) => {
	run.progress('capturing the pre-edit standards baseline over the whole repository — this is the last moment the tree is the state the run started from');

	try {
		const { findings, notes } = await runStandardsCheck({ cwd: run.cwd, config: run.config, persist: false, all: true });

		await writeRunStandardsBaseline({
			cwd: run.cwd,
			runId: run.current().runId,
			snapshot: { at: new Date().toISOString(), path: '.', findings, notes },
		});
		run.progress(`pre-edit standards baseline captured — ${findings.length} findings`);
	} catch (error) {
		const reason = messageOf({ error });

		run.progress(`pre-edit standards baseline not captured — ${reason}. Cleanup will have no comparison point; the run carries on.`);
	}
};

interface Params {
	run: PipelineRun;
	/** The distinct gate keys the plan's acceptance ledger names; empty when the plan carries no ledger. */
	ledgerGates: string[];
}

/**
 * Coverage runs here too because verify-tests holds the same bar later, so a
 * baseline that already misses it is the consumer's problem, not the run's. A
 * plan with an acceptance ledger has its per-test evidence probed here too:
 * this is the last moment before the run starts paying for agents.
 */
export const cleanSlateStep = ({ run, ledgerGates }: Params): PipelineStep['run'] => {
	return async () => {
		const record = run.nextRecord({ id: 'clean-slate' });

		await run.setStep({ record });
		run.progress(`step clean-slate — attempt ${record.attempts}`);

		// No acceptance rows here: the ledger's tests have not been written yet, so
		// every one of them would read as a test that never ran.
		const { error, coordination, timeouts, failures, gates } = await runVerificationGates({ run, coverage: true, checkpoint: 'clean-slate', rows: [] });

		// A gate run that never started is answered before the timeout-versus-red
		// check below, which only speaks about gates that ran.
		if (coordination !== undefined) {
			return stopOnGateCoordination({ run, stepId: 'clean-slate', record, coordination, error });
		}

		if (error) {
			// A gate that never finished is a different problem from a gate that
			// ran and went red, and the two want different first moves from a
			// human: raise the ceiling or free the machine, versus fix the code.
			// A gate that ran past its ceiling is reported through `timeouts` and
			// never reaches `failures`; a gate that failed to spawn is an ordinary
			// red that `createGateRunner` records as exit -1.
			const ranOut = timeouts.length > 0 || failures.some((failure) => failure.exitCode === -1);
			const headline = ranOut
				? 'A gate did not finish, so the codebase was never proved green — this is a timeout or a gate that could not start, not a failing test.'
				: 'Codebase is not green before implementation — fix this first.';

			return run.stop({ record, status: RunStatus.Failed, error: `${headline}\n${error}` });
		}

		const capability =
			ledgerGates.length === 0
				? undefined
				: await checkTestResultsCapability({ cwd: run.cwd, gates: ledgerGates, results: gates ?? [], onProgress: (message) => run.progress(message) });

		if (capability) {
			return run.stop({ record, status: RunStatus.Failed, error: capability });
		}

		// Gate commands may produce artifacts (coverage output, logs). Fold
		// anything that appeared during clean-slate into the baseline so it is
		// never attributed to the run's agents.
		const gateArtifacts = await readGitChangedFiles({ cwd: run.cwd });
		const baselineDirtyFiles = [...new Set([...run.current().baselineDirtyFiles, ...(gateArtifacts ?? [])])];
		// The last moment the tree is known to be the state the run started from,
		// and so the one place outside the ledger step and the review where an
		// approval happens: dirt that predates the first agent turn is approved
		// here, or the first checkpoint with a bundle would put it in front of the
		// reviewer as somebody's edit to a test. Build output an earlier phase left
		// on disk stays in the baseline but is never an agent's test edit.
		const generated = run.config.generated ?? [];
		const approvedTests = await approveTestFiles({
			run,
			paths: baselineDirtyFiles.filter((path) => isTestSideFile({ path }) && !isGeneratedPath({ path, generated })),
		});

		await captureStandardsBaseline({ run });

		await run.setStep({ record: { ...record, status: RunStatus.Passed }, patch: { baselineDirtyFiles, approvedTests } });
		run.progress('step clean-slate passed');

		return undefined;
	};
};
