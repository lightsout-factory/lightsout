import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import { usage } from '#src/cli/common/constants/usage.ts';
import { readRunConfig } from '#src/cli/common/readRunConfig.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { launchDetached } from '#src/cli/internal/common/detach/launchDetached.ts';
import { readLaunchRunId } from '#src/cli/internal/common/detach/readLaunchRunId.ts';
import { finishImplementRun } from '#src/cli/internal/common/implementRun/finishImplementRun.ts';
import { readResumeClearance } from '#src/cli/internal/common/implementRun/readResumeClearance.ts';
import { reportLiveOwner } from '#src/cli/internal/common/implementRun/reportLiveOwner.ts';
import { reportWorkOrderPlanOutcome } from '#src/cli/internal/common/implementRun/reportWorkOrderPlanOutcome.ts';
import { resolveRunCwd } from '#src/cli/internal/common/implementRun/resolveRunCwd.ts';
import { runResumedPipeline } from '#src/cli/internal/common/implementRun/runResumedPipeline.ts';
import { printRunHeader } from '#src/cli/internal/common/render/printRunHeader.ts';
import { resolveCommandHarness } from '#src/cli/internal/common/utils/resolveCommandHarness.ts';
import { formatResumeCommand } from '#src/common/formatResumeCommand.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { getDriver } from '#src/drivers/getDriver/getDriver.ts';
import { recordPlanCommandRun } from '#src/plan/progress/recordPlanCommandRun.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { writeRunManifest } from '#src/runState/writeRunManifest.ts';
import { runWorkOrderPlanLifecycle } from '#src/workOrder/implementRun/runWorkOrderPlanLifecycle.ts';

/** The pipelines this door continues; every other one resumes through its own command. */
const resumedHere: PipelineKind[] = [PipelineKind.Implement, PipelineKind.Phases, PipelineKind.Direct];

/** The run `--run` names, full or shortened; an unknown id the user typed is a message, never a stack trace. */
const readNamedRun = async ({ cwd, flags }: { cwd: string; flags: CommandContext['flags'] }) => {
	const runId = getStringFlag({ flags, name: 'run' });

	if (!runId) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	return readRunManifest({ cwd, runId }).catch((error: unknown) => {
		if (error instanceof RunNotFoundError) {
			console.error(error.message);
			return exitCli({ code: 1 });
		}

		throw error;
	});
};

/**
 * A phase resumed alone would have no owner behind it, so it would read stopped
 * while it ran and nothing could stop it: the sequence is what resumes.
 * `resumeFlags` carries on the flags the refused command was typed with.
 */
const refusePhaseChild = async ({ manifest, resumeFlags }: { manifest: RunManifest; resumeFlags: string }) => {
	if (manifest.parentRunId === undefined) {
		return;
	}

	console.error(
		`run ${manifest.runId} is a phase of sequence ${manifest.parentRunId} — resume it with: ${formatResumeCommand({ pipeline: PipelineKind.Phases, runId: manifest.parentRunId })}${resumeFlags}`,
	);
	return exitCli({ code: 1 });
};

const readResumableRun = async ({ cwd, flags }: { cwd: string; flags: CommandContext['flags'] }) => {
	const manifest = await readNamedRun({ cwd, flags });

	await refusePhaseChild({ manifest, resumeFlags: '' });

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
 * Where the run builds and the config it started with, never the launching
 * checkout's file. Both refuse before the tracker write and the ship restamp, so
 * a run whose recorded workspace has gone says so rather than quietly rebuilding
 * in the launching checkout, and a resume nothing will let happen mutates nothing
 * on the way to saying so.
 */
const locateResumedRun = async ({ cwd, manifest }: { cwd: string; manifest: RunManifest }) => {
	const located = await resolveRunCwd({ cwd, manifest });

	if ('error' in located) {
		console.error(located.error);
		return exitCli({ code: 1 });
	}

	const recorded = readRunConfig({ manifest });

	if ('error' in recorded) {
		console.error(recorded.error);
		return exitCli({ code: 1 });
	}

	return { workspace: located.workspace, loaded: recorded.config };
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

/**
 * The parent resolves the typed id to the full one and refuses only what no
 * handshake could confirm: a phase child never gets an owner record, so its
 * start could never be seen. Every other refusal is the child's, and lands in
 * the launch log.
 */
const launchDetachedResume = async ({ flags, rest, cwd }: CommandContext) => {
	if (flags.get('detach') !== true) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	const manifest = await readNamedRun({ cwd, flags });

	await refusePhaseChild({ manifest, resumeFlags: ' --detach' });

	return exitCli({ code: await launchDetached({ cwd, command: 'resume', args: rest, runId: manifest.runId }) });
};

export const resumeCommand = async ({ flags, rest, cwd }: CommandContext): Promise<void> => {
	// First, so nothing this process spawns inherits it. A resumed run's id is its
	// own --run id, so the value itself is not needed.
	readLaunchRunId({ env: process.env });

	if (flags.has('detach')) {
		return launchDetachedResume({ flags, rest, cwd });
	}

	const skipRefactor = flags.get('skip-refactor') === true;
	const { manifest, pipeline } = await readResumableRun({ cwd, flags });

	if (await reportLiveOwner({ cwd, manifest })) {
		return exitCli({ code: 1 });
	}

	const { workspace, loaded } = await locateResumedRun({ cwd, manifest });
	// From the manifest alone, so a phase the sequence never started is created with the config the sequence recorded.
	const loadedConfig: LoadedConfig = { config: loaded, path: manifest.configPath };
	const clearance = await readResumeClearance({ workspace, manifest, loaded, flags });

	if (clearance === undefined) {
		return exitCli({ code: 1 });
	}

	const { name, shipIntent } = clearance;
	const { resumable, config, driver } = await prepareResumedRun({ cwd, manifest, loaded, willShip: shipIntent.willShip });

	console.log(`lightsout: resuming run ${manifest.runId} (was: ${manifest.status}, plan: ${manifest.plan})`);
	await printRunHeader({ config, driver, cwd, configPath: manifest.configPath });

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
						loadedConfig,
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
