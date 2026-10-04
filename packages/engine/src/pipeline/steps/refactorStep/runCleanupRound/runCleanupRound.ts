import { CleanupEndReason } from '#src/contracts/run/CleanupEndReason.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { buildCleanupRecord } from '#src/pipeline/steps/common/buildCleanupRecord.ts';
import type { CleanupContext } from '#src/pipeline/steps/common/types/CleanupContext.ts';
import type { CleanupState } from '#src/pipeline/steps/common/types/CleanupState.ts';
import { runExecutorPass } from '#src/pipeline/steps/refactorStep/runCleanupRound/runExecutorPass.ts';

/** Both lists are measured against the same step-start fingerprint, so a round that touched nothing answers the identical set. */
const sameEdits = ({ before, after }: { before: string[]; after: string[] }) =>
	before.length === after.length && [...before].sort().join('\n') === [...after].sort().join('\n');

/**
 * A work list declined twice running is a stable disagreement: the checks cannot hear judgment,
 * so another round only re-buys the same answer. Checked before the budget so the more
 * specific reason is recorded.
 */
const foldDecline = ({ context, state, findings, round }: { context: CleanupContext; state: CleanupState; findings: StandardsFinding[]; round: number }) => {
	const declined = findings
		.map((finding) => finding.siteKey)
		.sort()
		.join('\n');

	if (declined === state.lastDeclined) {
		state.endReason = CleanupEndReason.DeclinedTwice;
		context.run.progress(`refactor round ${round}: the cleanup agent declined the same work list twice — no further round is bought`);

		return;
	}

	state.lastDeclined = declined;
	context.run.progress(`refactor round ${round}: no changes but ${findings.length} qualifying blocking finding(s) remain — another round`);
	state.record = { ...state.record, attempts: state.record.attempts + 1 };
};

interface Params {
	context: CleanupContext;
	state: CleanupState;
	findings: StandardsFinding[];
	/** Judgment-carrying findings the executor weighs but is never held on — the first round only. */
	advisories: StandardsFinding[];
}

/**
 * A failed round is recorded rather than terminal, because cleanup is best-effort tidying. A
 * park spends no round: the resume re-invokes that same one.
 */
export const runCleanupRound = async ({ context, state, findings, advisories }: Params): Promise<PipelineResult | undefined> => {
	const { run, gitPrefix, planContent, overviewContent, standards, before, budget } = context;
	const round = state.roundsUsed + 1;
	const record = buildCleanupRecord({ context, state });

	await run.setStep({ record });
	run.progress(`step refactor — round ${round}/${budget}`);

	const executed = await runExecutorPass({ run, gitPrefix, planContent, overviewContent, standards, record, findings, advisories, before });

	if ('parked' in executed) {
		return executed.parked;
	}

	const changed = !sameEdits({ before: state.edited, after: executed.edited });

	state.roundsUsed = round;
	state.record = executed.record;
	state.lastReport = executed.report ?? state.lastReport;
	state.edited = executed.edited;

	if (executed.failure !== undefined) {
		state.failures = [...state.failures, executed.failure];
		state.endReason = CleanupEndReason.AgentFailed;
		run.progress(`refactor round ${round}: the cleanup agent could not finish — ${executed.failure}`);
	} else if (changed) {
		state.lastDeclined = undefined;
		run.progress(`refactor round ${round}: ${executed.edited.length} changed file(s)`);
		state.record = { ...state.record, attempts: state.record.attempts + 1 };
	} else {
		foldDecline({ context, state, findings, round });
	}

	return undefined;
};
