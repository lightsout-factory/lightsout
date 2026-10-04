import { maxCheapFixRetries } from '#src/common/constants/maxCheapFixRetries.ts';
import { describeGateCoordinationStop } from '#src/common/describeGateCoordinationStop.ts';
import { describeGateNoVerdictStop } from '#src/common/describeGateNoVerdictStop.ts';
import { RunState } from '#src/common/RunState.ts';
import { runPreflightGate } from '#src/common/runPreflightGate.ts';
import type { AnsweredQuestion } from '#src/common/types/AnsweredQuestion.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { stopDirectRun } from '#src/direct/runDirectWork/common/stopDirectRun.ts';
import { createDirectRun } from '#src/direct/runDirectWork/createDirectRun.ts';
import { finishDirectRun } from '#src/direct/runDirectWork/finishDirectRun/finishDirectRun.ts';
import { invokeDirectWorker } from '#src/direct/runDirectWork/invokeDirectWorker.ts';
import { verifyDirectWork } from '#src/direct/runDirectWork/verifyDirectWork.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { withRunLock } from '#src/runState/lock/withRunLock/withRunLock.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';
import { resolveStandards } from '#src/standards/resolveStandards.ts';

interface Params {
	/** The checkout to build in — a queue worktree, or the user's own tree when run standalone. */
	cwd: string;
	/** The ticket body, verbatim. */
	ticketBody: string;
	/** The ticket's human reference, for the run header. */
	ticketRef: string;
	/** The id a fresh run is created under, minted by the caller so the run can be named before it starts. Ignored when resuming. */
	runId?: string;
	driver: Driver;
	/** Recorded on the manifest as the harness name. */
	driverName: string;
	config: LightsoutConfig;
	/** The config as it was read from disk, before the command stamped its harness on it, and its path. Recorded on a fresh run; a resume's manifest already carries it. */
	loadedConfig: LoadedConfig;
	/** The answer to a question a previous invocation asked — the queue's relay loop threads it back in. */
	answeredQuestion?: AnsweredQuestion;
	/** Resolved before the run starts: a passing run will ship this branch. Recorded on the manifest so the progress view can show a ship row. */
	willShip?: boolean;
	/** The run to continue instead of minting a new one — a resumed direct run keeps its id, its frozen ticket input and the partial changes already in its tree. */
	existing?: RunManifest;
	onProgress?: (message: string) => void;
	/** The queue run a worker build belongs to; the run's owner record points there. */
	queueRunId?: string;
}

/**
 * Nothing here was judged, so no fix attempt is spent and no worker is
 * re-invoked; the tree the run built is left exactly where it is.
 */
const stopDirectOnCoordination = ({ run, record, coordination }: { run: RunState; record: StepRecord; coordination: string }) => {
	run.progress('the gates never started — another run holds this machine, and no fix was attempted');

	return stopDirectRun({
		run,
		record,
		status: RunStatus.Escalated,
		error: describeGateCoordinationStop({ stepId: 'verify', coordination }),
	});
};

/**
 * Neither a crash nor a timeout reached a verdict, so there is nothing to
 * repair: it stops without spending an attempt, rather than handing the worker a
 * red no gate command established.
 */
const stopDirectOnNoVerdict = ({
	run,
	record,
	crashes,
	timeouts,
	gateError,
}: {
	run: RunState;
	record: StepRecord;
	crashes: string[];
	timeouts: string[];
	gateError: string | undefined;
}) => {
	const { ending, reason } = describeGateNoVerdictStop({ stepId: 'verify', crashes, timeouts });

	run.progress(`a gate ${ending} rather than failed — no fix attempted`);

	return stopDirectRun({ run, record, status: RunStatus.Escalated, error: [reason, gateError ?? ''].join('\n\n') });
};

/**
 * There is no supervisor, no unit-test writer and no standards review: the
 * repo's gates are the only bar.
 */
const buildAndVerify = async ({
	run,
	driver,
	ticketRef,
	ticketBody,
	standards,
	answeredQuestion,
	resumed,
}: {
	run: RunState;
	driver: Driver;
	ticketRef: string;
	ticketBody: string;
	standards?: string;
	answeredQuestion?: AnsweredQuestion;
	resumed: boolean;
}) => {
	let errorContext: string | undefined;

	for (let attempt = 0; ; attempt += 1) {
		const stopped = await invokeDirectWorker({ run, driver, ticketRef, ticketBody, standards, answeredQuestion, errorContext });

		if (stopped) {
			return stopped;
		}

		const { record, gateError, crashes, timeouts, coordination } = await verifyDirectWork({ run });

		if (coordination !== undefined) {
			return stopDirectOnCoordination({ run, record, coordination });
		}

		if (crashes.length > 0 || timeouts.length > 0) {
			return stopDirectOnNoVerdict({ run, record, crashes, timeouts, gateError });
		}

		if (gateError === undefined) {
			return finishDirectRun({ run, driver, ticketRef, ticketBody, resumed });
		}

		errorContext = gateError;

		if (attempt === maxCheapFixRetries) {
			return stopDirectRun({ run, record, status: RunStatus.Failed, error: gateError });
		}

		run.progress(`the gates are red — re-invoking the worker with their output (fix ${attempt + 1} of ${maxCheapFixRetries})`);
	}
};

/**
 * The coverage gate is included from the pre-flight onward, so a repo that
 * requires tests still requires them.
 *
 * A continued run (`existing` set) skips the pre-flight: the gate proves the
 * tree was green before any agent touched it, and a resumed tree holds the
 * run's own partial work, so re-running it would fail the run on the changes
 * the resume exists to preserve.
 *
 * A run whose `verify` step is already recorded passed goes straight to its
 * commit. The step record decides that, never the run's own status: a run
 * stopped at a refused commit is failed with its gates still green behind it.
 */
const executeDirectWork = async ({
	cwd,
	runId,
	ticketBody,
	ticketRef,
	driver,
	driverName,
	config,
	loadedConfig,
	answeredQuestion,
	willShip,
	existing,
	onProgress,
	queueRunId,
}: Params & { runId: string }) => {
	if (existing !== undefined) {
		await writeRunOwner({ cwd, runId: existing.runId, queueRunId });
	}

	const manifest = existing ?? (await createDirectRun({ cwd, runId, ticketBody, ticketRef, driverName, loadedConfig, willShip, queueRunId }));
	const run = new RunState({ cwd, config, manifest, onProgress });
	const stop = ({ record, status, error }: { record: StepRecord; status: RunStatus; error: string }) => stopDirectRun({ run, record, status, error });

	// Declared up front so a reader sees every step, unreached ones pending. A
	// resumed run's pre-flight is already recorded, so the skip leaves no pending row.
	await run.update({ patch: { status: RunStatus.Running, stepOrder: ['pre-flight', 'implement', 'verify'] } });

	if (run.current().steps.some((step) => step.id === 'verify' && step.status === RunStatus.Passed)) {
		return finishDirectRun({ run, driver, ticketRef, ticketBody, resumed: true });
	}

	const redBaseline =
		existing === undefined
			? await runPreflightGate({
					run: {
						cwd,
						config,
						current: () => run.current(),
						progress: (message: string) => run.progress(message),
						setStep: (params: { record: StepRecord; patch?: Partial<RunManifest> }) => run.setStep(params),
						stop,
					},
					coverage: true,
					label: 'pre-flight — the repo’s own gates before any agent',
					redBaselineError: `Codebase is not green before building ${ticketRef} — fix this first.`,
				})
			: undefined;

	if (redBaseline) {
		return redBaseline;
	}

	const { standards } = await resolveStandards({ cwd, config });

	return buildAndVerify({ run, driver, ticketRef, ticketBody, standards, answeredQuestion, resumed: existing !== undefined });
};

/**
 * A re-invocation (`answeredQuestion` set) continues the previous attempt's work
 * in the same tree but mints its own run, so every attempt keeps its own record.
 * A resume (`existing` set) continues the parked run instead.
 */
export const runDirectWork = (params: Params): Promise<PipelineResult> => withRunLock({ params, run: executeDirectWork });
