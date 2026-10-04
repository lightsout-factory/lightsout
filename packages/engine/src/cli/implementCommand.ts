import { randomUUID } from 'node:crypto';
import { usage } from '#src/cli/common/constants/usage.ts';
import { readLoadedConfig } from '#src/cli/common/readLoadedConfig.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { launchDetached } from '#src/cli/internal/common/detach/launchDetached.ts';
import { readLaunchRunId } from '#src/cli/internal/common/detach/readLaunchRunId.ts';
import { finishImplementRun } from '#src/cli/internal/common/implementRun/finishImplementRun.ts';
import { openImplementWorkspace } from '#src/cli/internal/common/implementRun/openImplementWorkspace.ts';
import { reportWorkOrderPlanOutcome } from '#src/cli/internal/common/implementRun/reportWorkOrderPlanOutcome.ts';
import { resolveImplementInputs } from '#src/cli/internal/common/implementRun/resolveImplementInputs.ts';
import { printRunStart } from '#src/cli/internal/common/render/printRunStart.ts';
import type { PlanTarget } from '#src/cli/internal/common/types/PlanTarget.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { resolveCommandHarness } from '#src/cli/internal/common/utils/resolveCommandHarness.ts';
import { resolveCommandShipIntent } from '#src/cli/internal/common/utils/resolveCommandShipIntent.ts';
import { runPhasesOrFailFast } from '#src/cli/internal/common/utils/runPhasesOrFailFast.ts';
import { runPipelineOrFailFast } from '#src/cli/internal/common/utils/runPipelineOrFailFast.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { getDriver } from '#src/drivers/getDriver/getDriver.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { recordPlanCommandRun } from '#src/plan/progress/recordPlanCommandRun.ts';
import { requireImplementLifecycle } from '#src/ticketLifecycle/requireImplementLifecycle.ts';
import { runWorkOrderPlanLifecycle } from '#src/workOrder/implementRun/runWorkOrderPlanLifecycle.ts';

/**
 * The record is opened here rather than in the pipeline so a phased plan records
 * one run, not one per phase. It is written to the launching checkout `cwd`,
 * while the source work happens in `workspace`.
 */
const runResolvedPipeline = ({
	cwd,
	workspace,
	planName,
	target,
	overviewPath,
	packages,
	startPhase,
	runId,
	driver,
	config,
	loadedConfig,
	skipRefactor,
	willShip,
}: {
	cwd: string;
	workspace: string;
	planName: string | undefined;
	target: PlanTarget;
	overviewPath: string | undefined;
	packages: string[] | undefined;
	startPhase: number | undefined;
	/** The id the run is created under, minted before it started so the ticket record can name it. */
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	/** The config as it was read from disk, before the command stamped its harness on it, and its path. */
	loadedConfig: LoadedConfig;
	skipRefactor: boolean;
	willShip: boolean;
}) =>
	// Written out because inferring it would be circular: `work`'s own parameter is typed from it.
	recordPlanCommandRun<PipelineResult>({
		cwd,
		name: planName,
		label: 'implement',
		statusOf: ({ result }) => result.manifest.status,
		work: ({ level }) =>
			'overviewPath' in target
				? runPhasesOrFailFast({
						cwd: workspace,
						driver,
						config,
						loadedConfig,
						overviewPath: target.overviewPath,
						startPhase,
						runId,
						skipRefactor,
						willShip,
						level,
						onProgress: createProgressPrinter(),
					})
				: runPipelineOrFailFast({
						cwd: workspace,
						planPath: target.planPath,
						overviewPath,
						packages,
						runId,
						driver,
						config,
						loadedConfig,
						skipRefactor,
						willShip,
						level,
						onProgress: createProgressPrinter(),
					}),
	});

/**
 * The parent reads no config, opens no workspace and touches no tracker: every
 * refusal is the child's to make, so it lands in the launch log and is relayed.
 */
const launchDetachedImplement = async ({ flags, rest, cwd }: CommandContext) => {
	if (flags.get('detach') !== true) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	return exitCli({ code: await launchDetached({ cwd, command: 'implement', args: rest, runId: randomUUID() }) });
};

export const implementCommand = async ({ flags, rest, cwd }: CommandContext): Promise<void> => {
	// First, so nothing this process spawns inherits an id meant for it alone.
	const launchedRunId = readLaunchRunId({ env: process.env });

	if (flags.has('detach')) {
		return launchDetachedImplement({ flags, rest, cwd });
	}

	const inputs = await resolveImplementInputs({ flags, cwd });

	if ('error' in inputs) {
		console.error(inputs.error);
		return exitCli({ code: 1 });
	}

	const { planPath, overviewPath, packages, startPhase, planName, shipRequest } = inputs;
	const skipRefactor = flags.get('skip-refactor') === true;
	// From the launching checkout, never the opened workspace: the run follows the config it was launched with.
	const loadedConfig = await readLoadedConfig({ cwd });
	const { config: loaded, path: configPath } = loadedConfig;
	const { driverName, model, effort } = resolveCommandHarness({ config: loaded, command: 'implement' });
	const driver = getDriver({ name: driverName });
	const config = { ...loaded, harness: driverName, model, effort };
	const shipIntent = resolveCommandShipIntent({ config: loaded, flags, env: process.env, shipRequest });

	if (shipIntent === undefined) {
		return exitCli({ code: 1 });
	}

	const opened = await openImplementWorkspace({ cwd, config: loaded, flags, planPath });

	if ('error' in opened) {
		console.error(opened.error);
		return exitCli({ code: 1 });
	}

	const { workspace, target } = opened;

	// Before the pipeline, so the ticket records that implementation has begun
	// before an agent touches any source.
	const refused = await requireImplementLifecycle({ cwd: workspace.cwd, config: loaded, env: process.env, onProgress: createProgressPrinter() });

	if (refused !== undefined) {
		console.error(refused);
		return exitCli({ code: 1 });
	}

	await printRunStart({ target, overviewPath, packages, startPhase, config, driver, cwd: workspace.cwd, configPath });

	const outcome = await runWorkOrderPlanLifecycle({
		cwd: workspace.cwd,
		name: planName,
		runId: launchedRunId,
		run: ({ runId }) =>
			runResolvedPipeline({
				cwd,
				workspace: workspace.cwd,
				planName,
				target,
				overviewPath,
				packages,
				startPhase,
				runId,
				driver,
				config,
				loadedConfig,
				skipRefactor,
				willShip: shipIntent.willShip,
			}),
	});

	const result = reportWorkOrderPlanOutcome({ outcome });

	if (result === undefined) {
		return exitCli({ code: 1 });
	}

	return finishImplementRun({ config: loaded, cwd: workspace.cwd, result, flags });
};
