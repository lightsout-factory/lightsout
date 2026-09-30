import { defaultRefactorMaxRounds } from '#src/common/constants/defaultRefactorMaxRounds.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import { CleanupEndReason } from '#src/contracts/run/CleanupEndReason.ts';
import type { RefactorStepReport } from '#src/contracts/run/RefactorStepReport.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { sourceFiles } from '#src/pipeline/internal/common/utils/sourceFiles.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/internal/PipelineStep.ts';
import type { CleanupContext } from '#src/pipeline/steps/refactorStep/internal/common/types/CleanupContext.ts';
import type { CleanupState } from '#src/pipeline/steps/refactorStep/internal/common/types/CleanupState.ts';
import { buildCleanupRecord } from '#src/pipeline/steps/refactorStep/internal/common/utils/buildCleanupRecord.ts';
import { describePersistingFindings } from '#src/pipeline/steps/refactorStep/internal/common/utils/describePersistingFindings.ts';
import { fingerprintScopeFiles } from '#src/pipeline/steps/refactorStep/internal/common/utils/fingerprintScopeFiles.ts';
import { readPriorCleanup } from '#src/pipeline/steps/refactorStep/internal/common/utils/readPriorCleanup.ts';
import { reviewAdvisories } from '#src/pipeline/steps/refactorStep/internal/common/utils/reviewAdvisories.ts';
import { runCleanupRound } from '#src/pipeline/steps/refactorStep/internal/common/utils/runCleanupRound.ts';
import { standardsWorkList } from '#src/pipeline/steps/refactorStep/internal/common/utils/standardsWorkList.ts';
import { readRunStandardsBaseline } from '#src/runState/standardsBaseline/readRunStandardsBaseline.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups.ts';

interface Params {
	run: PipelineRun;
	gitPrefix?: string;
	planContent: string;
	overviewContent?: string;
	standards?: string;
}

/** A resume reuses the recorded initial review rather than buying a second one: it describes code the resume has not changed. */
const buildCleanupContext = async ({ run, gitPrefix, planContent, overviewContent, standards, prior }: Params & { prior: RefactorStepReport | undefined }) => {
	// The scope as it stands now, which may have widened since the run began; empty covers every package.
	const scoped = run.current().packages;
	const groups = await resolveStandardsGroups({ cwd: run.cwd, config: run.config, packages: scoped.length > 0 ? scoped : undefined });
	const baseline = await readRunStandardsBaseline({ cwd: run.cwd, runId: run.current().runId });

	return {
		run,
		gitPrefix,
		planContent,
		overviewContent,
		standards,
		groups,
		baseline: baseline?.findings,
		budget: run.config.implement?.refactor?.['max-rounds'] ?? defaultRefactorMaxRounds,
		before: await fingerprintScopeFiles({ run }),
		initialReview: prior?.initialReview ?? (await reviewAdvisories({ run, groups, files: sourceFiles({ run }) })),
	};
};

const narrateGate = ({ run, workList, advisories }: { run: PipelineRun; workList: StandardsFinding[]; advisories: StandardsFinding[] }) => {
	if (workList.length > 0 || advisories.length > 0) {
		run.progress(`standards gate: ${workList.length} blocking + ${advisories.length} advisory on changed files`);
	}
};

/** Only the first round may be earned by advisories, so the opening advisory pass is never replayed as an open-ended tidy. */
const runCleanupRounds = async ({ context, state }: { context: CleanupContext; state: CleanupState }) => {
	while (state.endReason === undefined) {
		const check = await standardsWorkList({ run: context.run, baseline: context.baseline });
		const advisories = state.roundsUsed === 0 ? [...check.advisories, ...context.initialReview] : [];

		state.remaining = check.workList;
		state.inherited = check.inherited;
		state.uncertain = check.uncertain;
		narrateGate({ run: context.run, workList: check.workList, advisories });

		if (check.workList.length === 0 && advisories.length === 0) {
			state.endReason = state.roundsUsed === 0 ? CleanupEndReason.NoWork : CleanupEndReason.Clean;
		} else if (state.roundsUsed >= context.budget) {
			state.endReason = CleanupEndReason.BudgetExhausted;
		} else {
			const parked = await runCleanupRound({ context, state, findings: check.workList, advisories });

			if (parked) {
				return parked;
			}
		}
	}

	return undefined;
};

/** Filtered like the opening review's `sourceFiles`, so both reviews read the same kind of file. */
const finishCleanup = async ({ context, state }: { context: CleanupContext; state: CleanupState }) => {
	const { run, groups } = context;

	if (state.endReason === CleanupEndReason.AgentFailed) {
		state.remaining = (await standardsWorkList({ run, baseline: context.baseline })).workList;
	}

	const reviewed = state.edited.filter((file) => !isTestFile({ path: file }));

	state.finalReview = reviewed.length === 0 ? context.initialReview : await reviewAdvisories({ run, groups, files: reviewed });

	if (state.remaining.length > 0) {
		state.narration = describePersistingFindings({ findings: state.remaining, report: state.lastReport, roundsUsed: state.roundsUsed });
		run.progress(state.narration);
	}

	await run.setStep({ record: { ...buildCleanupRecord({ context, state }), status: RunStatus.Passed } });
	run.progress(`step refactor passed — cleanup ended: ${state.endReason}`);
};

/**
 * A round is bought only while a blocking finding this run introduced or worsened still stands;
 * pre-existing debt, uncertain provenance and reviewer opinions are recorded, never turned into
 * work. Nothing here stops the run: only a rate limit parks it.
 */
export const refactorStep = ({ run, gitPrefix, planContent, overviewContent, standards }: Params): PipelineStep['run'] => {
	return async () => {
		const record = run.nextRecord({ id: 'refactor' });
		const prior = readPriorCleanup({ run });
		const context = await buildCleanupContext({ run, gitPrefix, planContent, overviewContent, standards, prior });
		const state: CleanupState = {
			record,
			roundsUsed: prior?.roundsUsed ?? 0,
			edited: [],
			failures: prior?.failures ?? [],
			remaining: [],
			inherited: [],
			uncertain: [],
			finalReview: [],
		};

		const parked = await runCleanupRounds({ context, state });

		if (parked) {
			return parked;
		}

		await finishCleanup({ context, state });

		return undefined;
	};
};
