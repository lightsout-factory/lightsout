import { getAgentOutcomeStatus } from '#src/invoke/getAgentOutcomeStatus.ts';
import { approveTestFiles } from '#src/pipeline/approvedTests/approveTestFiles.ts';
import { applyTestDispositions } from '#src/pipeline/approvedTests/internal/applyTestDispositions.ts';
import { collectTestChanges } from '#src/pipeline/approvedTests/internal/collectTestChanges.ts';
import { consultTestChangeReviewer } from '#src/pipeline/approvedTests/internal/consultTestChangeReviewer.ts';
import { isTestSideFile } from '#src/pipeline/common/isTestSideFile.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { appendTestReview } from '#src/runState/appendTestReview.ts';

interface Params {
	run: PipelineRun;
	/** The verification checkpoint in flight — it labels the agent stream, the usage row and the journal line. */
	checkpoint: string;
	planContent: string;
	overviewContent?: string;
}

/**
 * A rejection writes nothing to the manifest, so the next attempt re-reviews
 * the whole bundle against the same baseline the repairing role was shown.
 * The engine never writes to the working tree here.
 *
 * @returns an empty object when the bundle was empty or every change was
 * approved; `error` when the checkpoint must go red under the review family;
 * `rateLimited` when the reviewer was rate limited and the run must park.
 */
export const reviewTestChanges = async ({ run, checkpoint, planContent, overviewContent }: Params): Promise<{ error?: string; rateLimited?: boolean }> => {
	const changes = await collectTestChanges({ run });

	if (changes.length === 0) {
		return {};
	}

	const manifest = run.current();
	const step = `${checkpoint}-test-review`;

	run.progress(`${checkpoint}: ${changes.length} test-side file(s) changed — reviewing them against the plan before the gates run`);

	const stepLevel = run.openStepLevel({ step });
	const outcome = await consultTestChangeReviewer({
		driver: run.driver,
		cwd: run.cwd,
		config: run.config,
		planContent,
		overviewContent,
		checkpoint,
		acceptanceTests: manifest.acceptanceTests,
		changedFiles: manifest.changedFiles.filter((file) => !isTestSideFile({ path: file })),
		changes,
		onEvent: run.agentEventSink({ step }),
		onRejectedOutput: run.persistRejected({ step }),
		activity: stepLevel,
	});

	// Closed before the usage record and before either red branch below, so a
	// rate-limited or refused review still ends its own level.
	stepLevel?.close({ outcome: getAgentOutcomeStatus({ outcome }) });

	await run.recordUsage({ step, usage: outcome.usage });

	if (!outcome.ok) {
		// A judge that did not answer is the same shape of red as a judge that
		// said no, and the checkpoint's own repair budget bounds both.
		return outcome.rateLimited ? { rateLimited: true } : { error: `${checkpoint}: the test-change reviewer did not return a verdict — ${outcome.failure}` };
	}

	const applied = await applyTestDispositions({ run, changes, review: outcome.report, acceptanceTests: manifest.acceptanceTests });

	await appendTestReview({
		cwd: run.cwd,
		runId: manifest.runId,
		record: { checkpoint, at: new Date().toISOString(), verdicts: outcome.report.verdicts, rejections: applied.rejections },
	});

	if (applied.rejections.length > 0) {
		return {
			error: [
				"the test-change review refused this checkpoint's changes to the tests; no gate ran.",
				...applied.rejections.map((rejection) => `- ${rejection}`),
			].join('\n'),
		};
	}

	const approvedTests = await approveTestFiles({ run, paths: applied.approvedPaths });

	await run.update({ patch: { approvedTests, acceptanceTests: applied.acceptanceTests } });
	run.progress(`${checkpoint}: the test-change review approved ${applied.approvedPaths.length} test-side file(s) — they are the baseline from here`);

	return {};
};
