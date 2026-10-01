import type { ActivityLevel } from '#src/activity/common/types/ActivityLevel.ts';
import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import { usage } from '#src/cli/common/constants/usage.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { continueDirectRun } from '#src/cli/internal/common/implementRun/continueDirectRun.ts';
import { finishImplementRun } from '#src/cli/internal/common/implementRun/finishImplementRun.ts';
import { readResumeClearance } from '#src/cli/internal/common/implementRun/readResumeClearance.ts';
import { reportWorkOrderPlanOutcome } from '#src/cli/internal/common/implementRun/reportWorkOrderPlanOutcome.ts';
import { resolveRunCwd } from '#src/cli/internal/common/implementRun/resolveRunCwd.ts';
import { printRunHeader } from '#src/cli/internal/common/render/printRunHeader.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { resolveCommandHarness } from '#src/cli/internal/common/utils/resolveCommandHarness.ts';
import { runPhasesOrFailFast } from '#src/cli/internal/common/utils/runPhasesOrFailFast.ts';
import { runPipelineOrFailFast } from '#src/cli/internal/common/utils/runPipelineOrFailFast.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { resolveConfigPath } from '#src/common/config/resolveConfigPath.ts';
import { formatResumeCommand } from '#src/common/utils/formatResumeCommand.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { getDriver } from '#src/drivers/getDriver.ts';
import { recordPlanCommandRun } from '#src/plan/progress/recordPlanCommandRun.ts';
import { isRecordedProcessAlive } from '#src/runState/isRecordedProcessAlive.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { resolveOwnerProcess } from '#src/runState/owner/resolveOwnerProcess.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { writeRunManifest } from '#src/runState/writeRunManifest.ts';
import { runWorkOrderPlanLifecycle } from '#src/workOrder/implementRun/runWorkOrderPlanLifecycle.ts';

/** The pipelines this door continues; every other one resumes through its own command. */
const resumedHere: PipelineKind[] = [PipelineKind.Implement, PipelineKind.Phases, PipelineKind.Direct];

const readResumableRun = async ({ cwd, flags }: { cwd: string; flags: CommandContext['flags'] }) => {
	const runId = getStringFlag({ flags, name: 'run' });

	if (!runId) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	// An unknown run id the user typed is a message, never a stack trace.
	const manifest = await readRunManifest({ cwd, runId }).catch((error: unknown) => {
		if (error instanceof RunNotFoundError) {
			console.error(error.message);
			return exitCli({ code: 1 });
		}

		throw error;
	});

	// A phase resumed alone would have no owner behind it, so it would read
	// stopped while it ran and nothing could stop it: the sequence is what resumes.
	if (manifest.parentRunId !== undefined) {
		console.error(
			`run ${manifest.runId} is a phase of sequence ${manifest.parentRunId} — resume it with: ${formatResumeCommand({ pipeline: PipelineKind.Phases, runId: manifest.parentRunId })}`,
		);
		return exitCli({ code: 1 });
	}

	const pipeline = manifest.pipeline ?? PipelineKind.Implement;
	if (!resumedHere.includes(pipeline)) {
		console.error(`run ${manifest.runId} belongs to the ${pipeline} pipeline — resume it with: ${formatResumeCommand({ pipeline, runId: manifest.runId })}`);
		return exitCli({ code: 1 });
	}

	// A direct run's `passed` means the build and gates are done while the commit
	// or ship is not, so it is still resumable, from the commit.
	if (manifest.status === RunStatus.Passed && pipeline !== PipelineKind.Direct) {
		console.error(`run ${manifest.runId} already passed — nothing to resume`);
		return exitCli({ code: 1 });
	}

	return { manifest, pipeline };
};

/**
 * A second process must never take over a run whose owner still lives. Judged
 * whatever the manifest says, because a passed direct run's first process may
 * still be committing or shipping outside the lock. A queue worker's record
 * points at the queue, and stop refuses a worker run, so the queue run is the
 * one named. A run with no owner record refuses nothing: the run lock guards it.
 */
const refuseLiveOwner = async ({ cwd, manifest }: { cwd: string; manifest: RunManifest }) => {
	const owner = await readRunOwner({ cwd, runId: manifest.runId });
	const queueRunId = owner !== undefined && 'queueRunId' in owner ? owner.queueRunId : undefined;
	const recorded = owner === undefined ? undefined : await resolveOwnerProcess({ cwd, owner });

	if (recorded === undefined || !(await isRecordedProcessAlive(recorded))) {
		return;
	}

	console.error(
		queueRunId === undefined
			? `run ${manifest.runId} is still running under process ${recorded.pid} — stop it first with: lightsout stop --run ${manifest.runId}`
			: `run ${manifest.runId} is a worker of queue run ${queueRunId}, still running under process ${recorded.pid} — stop the queue first with: lightsout stop --run ${queueRunId}`,
	);
	return exitCli({ code: 1 });
};

const runResumedPipeline = ({
	pipeline,
	cwd,
	workspace,
	driver,
	config,
	willShip,
	resumable,
	skipRefactor,
	level,
}: {
	pipeline: PipelineKind;
	cwd: string;
	workspace: string;
	driver: Driver;
	config: LightsoutConfig;
	willShip: boolean;
	resumable: RunManifest;
	skipRefactor: boolean;
	/** The command-run level this continuation's work hangs from, or undefined when nothing is being recorded. */
	level: ActivityLevel | undefined;
}) => {
	if (pipeline === PipelineKind.Direct) {
		return continueDirectRun({ cwd, workspace, manifest: resumable, config, driver, willShip });
	}

	const params = { cwd: workspace, driver, config, existing: resumable, skipRefactor, level, onProgress: createProgressPrinter() };

	return pipeline === PipelineKind.Phases ? runPhasesOrFailFast(params) : runPipelineOrFailFast(params);
};

/**
 * The ship intent is restamped because it is resolved fresh for every invocation,
 * and the progress view draws a ship row from it.
 *
 * The harness is the manifest's, never the config's. The config's model applies
 * only when it targets that same harness; effort is harness-neutral.
 */
const prepareResumedRun = async ({ cwd, manifest, loaded, willShip }: { cwd: string; manifest: RunManifest; loaded: LightsoutConfig; willShip: boolean }) => {
	const resumable = (manifest.willShip === true) === willShip ? manifest : await writeRunManifest({ cwd, manifest: { ...manifest, willShip } });
	const resolved = resolveCommandHarness({ config: loaded, command: 'implement' });
	const config = {
		...loaded,
		harness: manifest.harness,
		model: resolved.driverName === manifest.harness ? resolved.model : undefined,
		effort: resolved.effort,
	};

	return { resumable, config, driver: getDriver({ name: manifest.harness }) };
};

export const resumeCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const skipRefactor = flags.get('skip-refactor') === true;
	const { manifest, pipeline } = await readResumableRun({ cwd, flags });

	await refuseLiveOwner({ cwd, manifest });

	// First, so a run whose recorded workspace has gone says so before anything is
	// mutated, rather than quietly rebuilding in the launching checkout.
	const located = await resolveRunCwd({ cwd, manifest });

	if ('error' in located) {
		console.error(located.error);
		return exitCli({ code: 1 });
	}

	const workspace = located.workspace;
	const loaded = await readConfig({ cwd });
	// Before the tracker write and before the ship restamp, so a resume nothing
	// will let happen mutates nothing on the way to saying so.
	const clearance = await readResumeClearance({ workspace, manifest, loaded, flags });

	if (clearance === undefined) {
		return exitCli({ code: 1 });
	}

	const { name, shipIntent } = clearance;
	const { resumable, config, driver } = await prepareResumedRun({ cwd, manifest, loaded, willShip: shipIntent.willShip });

	console.log(`lightsout: resuming run ${manifest.runId} (was: ${manifest.status}, plan: ${manifest.plan})`);
	await printRunHeader({ config, driver, cwd, configPath: resolveConfigPath({ cwd }) });

	// A direct run records no command run: its plan path is a frozen ticket body.
	const outcome = await runWorkOrderPlanLifecycle({
		cwd: workspace,
		name,
		resumeRunId: manifest.runId,
		run: () =>
			recordPlanCommandRun({
				cwd,
				name: pipeline === PipelineKind.Direct ? undefined : name,
				label: 'resume',
				statusOf: ({ result }) => result.manifest.status,
				work: ({ level }) =>
					runResumedPipeline({
						pipeline,
						cwd,
						workspace,
						driver,
						config,
						willShip: shipIntent.willShip,
						resumable,
						skipRefactor,
						level,
					}),
			}),
	});

	const result = reportWorkOrderPlanOutcome({ outcome });

	if (result === undefined) {
		return exitCli({ code: 1 });
	}

	return finishImplementRun({ config: loaded, cwd: workspace, result, flags });
};
