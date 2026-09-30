import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
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
import { readConfig } from '#src/common/config/readConfig.ts';
import { resolveConfigPath } from '#src/common/config/resolveConfigPath.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { getDriver } from '#src/drivers/getDriver.ts';
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
						skipRefactor,
						willShip,
						level,
						onProgress: createProgressPrinter(),
					}),
	});

export const implementCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const inputs = await resolveImplementInputs({ flags, cwd });

	if ('error' in inputs) {
		console.error(inputs.error);
		return exitCli({ code: 1 });
	}

	const { planPath, overviewPath, packages, startPhase, planName, shipRequest } = inputs;
	const skipRefactor = flags.get('skip-refactor') === true;
	const loaded = await readConfig({ cwd });
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

	await printRunStart({ target, overviewPath, packages, startPhase, config, driver, cwd: workspace.cwd, configPath: resolveConfigPath({ cwd }) });

	const outcome = await runWorkOrderPlanLifecycle({
		cwd: workspace.cwd,
		name: planName,
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
