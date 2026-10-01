import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { getRequiredFlag } from '#src/cli/internal/common/args/getRequiredFlag.ts';
import { finishImplementRun } from '#src/cli/internal/common/implementRun/finishImplementRun.ts';
import { openDirectWorkspace } from '#src/cli/internal/common/implementRun/openDirectWorkspace.ts';
import { readBodyBuildTarget } from '#src/cli/internal/common/implementRun/readBodyBuildTarget.ts';
import { printConfigSource } from '#src/cli/internal/common/render/printConfigSource.ts';
import type { BodyBuildTarget } from '#src/cli/internal/common/types/BodyBuildTarget.ts';
import type { RunWorkspace } from '#src/cli/internal/common/types/RunWorkspace.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { resolveCommandShipIntent } from '#src/cli/internal/common/utils/resolveCommandShipIntent.ts';
import { resolveEffectiveConfigAndDriver } from '#src/cli/internal/common/utils/resolveEffectiveConfigAndDriver.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { resolveConfigPath } from '#src/common/config/resolveConfigPath.ts';
import { readGitCurrentBranch } from '#src/common/git/readGitCurrentBranch.ts';
import { readRunLabel } from '#src/common/utils/readRunLabel.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { runDirectWork } from '#src/direct/runDirectWork.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { requireImplementLifecycle } from '#src/ticketLifecycle/requireImplementLifecycle.ts';
import type { WorkOrderPlanOutcome } from '#src/workOrder/common/types/WorkOrderPlanOutcome.ts';
import { runWorkOrderBodyBuildLifecycle } from '#src/workOrder/implementRun/runWorkOrderBodyBuildLifecycle.ts';
import { runWorkOrderPlanLifecycle } from '#src/workOrder/implementRun/runWorkOrderPlanLifecycle.ts';

/** A build the record says nothing about runs under an id nobody minted in advance. */
const runRecordedBuild = async ({
	cwd,
	target,
	build,
}: {
	cwd: string;
	target: BodyBuildTarget | undefined;
	build: (runId?: string) => ReturnType<typeof runDirectWork>;
}): Promise<WorkOrderPlanOutcome> => {
	if (target === undefined) {
		return { result: await build() };
	}

	const run = ({ runId }: { runId: string }) => build(runId);

	return 'planName' in target
		? runWorkOrderPlanLifecycle({ cwd, name: target.planName, run })
		: runWorkOrderBodyBuildLifecycle({ cwd, workOrderName: target.workOrderName, run });
};

const runDirectBuild = async ({
	cwd,
	target,
	ticketBody,
	ticketRef,
	driver,
	driverName,
	config,
	willShip,
}: {
	cwd: string;
	/** What the record says this build implements, when it says anything. */
	target: BodyBuildTarget | undefined;
	ticketBody: string;
	ticketRef: string;
	driver: Driver;
	driverName: string;
	config: LightsoutConfig;
	willShip: boolean;
}) => {
	const build = (runId?: string) =>
		runDirectWork({ cwd, ticketBody, ticketRef, runId, driver, driverName, config, willShip, onProgress: createProgressPrinter() });
	const outcome = await runRecordedBuild({ cwd, target, build });

	if ('refusal' in outcome) {
		return { refusal: outcome.refusal };
	}

	const { result } = outcome;
	const recordError = 'recordError' in outcome ? outcome.recordError : undefined;

	return { result, recordError };
};

/**
 * Everything here reads the workspace, not the launching checkout, because the
 * branch the build happens on is the one they answer for.
 */
const prepareDirectRun = async ({
	workspace,
	loaded,
	flaggedRef,
}: {
	workspace: RunWorkspace;
	loaded: LightsoutConfig;
	/** `--ref` as typed, or undefined. */
	flaggedRef: string | undefined;
}) => {
	const ticketRef = flaggedRef ?? (await readRunLabel({ cwd: workspace.cwd }));
	const { config, driver, driverName } = resolveEffectiveConfigAndDriver({ config: loaded, command: 'implement' });
	// Handed `--ref` itself rather than `ticketRef`, whose branch-name fallback
	// is a run label, not a ticket reference.
	const refused = await requireImplementLifecycle({
		cwd: workspace.cwd,
		config: loaded,
		env: process.env,
		ticketRef: flaggedRef,
		onProgress: createProgressPrinter(),
	});

	if (refused !== undefined) {
		return { error: refused };
	}

	const target = await readBodyBuildTarget({ cwd: workspace.cwd, branch: workspace.branch ?? (await readGitCurrentBranch({ cwd: workspace.cwd })) });

	return target !== undefined && 'error' in target ? target : { ticketRef, config, driver, driverName, target };
};

const printDirectRunHeader = ({
	workspace,
	ticketRef,
	ticketPath,
	configPath,
}: {
	workspace: RunWorkspace;
	ticketRef: string;
	ticketPath: string;
	configPath: string;
}) => {
	const where = workspace.isolated ? `${workspace.cwd} on ${workspace.branch}` : `${workspace.cwd} — the checkout this was launched from`;

	console.log(`lightsout: building ${ticketRef} from ${ticketPath} in ${where}`);
	printConfigSource({ configPath });
};

/**
 * The commit is the pipeline's, made before the run is stamped passed, so a run
 * that produced none is already a failure here.
 *
 * There is deliberately no current-branch check: a default-branch mistake is
 * refused downstream by ship.
 */
export const implementDirectCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const namedTicketPath = await getRequiredFlag({ flags, name: 'ticket' });
	// Read from the launching checkout, before anything is created, so a missing
	// file is refused without a worktree being made for it.
	const ticketBody = await readFile(resolve(cwd, namedTicketPath), 'utf8').catch(() => undefined);

	if (ticketBody === undefined) {
		console.error(`ticket file not found: ${namedTicketPath}`);
		return exitCli({ code: 1 });
	}

	const loaded = await readConfig({ cwd });
	const shipIntent = resolveCommandShipIntent({ config: loaded, flags, env: process.env });

	if (shipIntent === undefined) {
		return exitCli({ code: 1 });
	}

	const flaggedRef = getStringFlag({ flags, name: 'ref' });
	const opened = await openDirectWorkspace({ cwd, config: loaded, flags, ticketPath: namedTicketPath, flaggedRef });

	if ('error' in opened) {
		console.error(opened.error);
		return exitCli({ code: 1 });
	}

	const { workspace, ticketPath } = opened;
	const prepared = await prepareDirectRun({ workspace, loaded, flaggedRef });

	if ('error' in prepared) {
		console.error(prepared.error);
		return exitCli({ code: 1 });
	}

	const { ticketRef, config, driver, driverName, target } = prepared;

	printDirectRunHeader({ workspace, ticketRef, ticketPath, configPath: resolveConfigPath({ cwd }) });

	const built = await runDirectBuild({
		cwd: workspace.cwd,
		target,
		ticketBody,
		ticketRef,
		driver,
		driverName,
		config,
		willShip: shipIntent.willShip,
	});

	if ('refusal' in built) {
		console.error(built.refusal);
		return exitCli({ code: 1 });
	}

	const { result, recordError } = built;

	if (recordError !== undefined) {
		console.error(recordError);
	}

	return finishImplementRun({ config: loaded, cwd: workspace.cwd, result, flags });
};
