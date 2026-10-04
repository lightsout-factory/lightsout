import { contradictoryShipFlagsMessage } from '#src/cli/internal/common/constants/contradictoryShipFlagsMessage.ts';
import { unusableTicketPatternMessage } from '#src/cli/internal/common/constants/unusableTicketPatternMessage.ts';
import { removeShippedRunWorkspace } from '#src/cli/internal/common/implementRun/removeShippedRunWorkspace.ts';
import { resolveRunCwd } from '#src/cli/internal/common/implementRun/resolveRunCwd.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { getRunResultExitCode } from '#src/cli/internal/common/utils/getRunResultExitCode.ts';
import { resolveEffectiveConfigAndDriver } from '#src/cli/internal/common/utils/resolveEffectiveConfigAndDriver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { planNameFromPath } from '#src/plan/planNameFromPath.ts';
import { resolveShipIntent } from '#src/ship/resolveShipIntent.ts';
import { runShip } from '#src/ship/runShip/runShip.ts';
import { reconcileShippedTicket } from '#src/ticketLifecycle/reconcileShippedTicket/reconcileShippedTicket.ts';
import { createWorkOrderShipGuard } from '#src/workOrder/implementRun/createWorkOrderShipGuard.ts';
import { readWorkOrderRunTerms } from '#src/workOrder/implementRun/readWorkOrderRunTerms.ts';

interface Params {
	config: LightsoutConfig;
	cwd: string;
	/** How the run ended. A failed or paused run never ships. */
	result: PipelineResult;
	/** Whether `--ship` was typed. The config's `after-implement` is the other way in. */
	shipFlag: boolean;
	/** Whether `--no-ship` was typed. Beats the config's `after-implement`. */
	noShipFlag: boolean;
	/** The process environment, read for the queue's own suppression variable. Passed rather than read, so a test never needs to mutate `process.env`. */
	env: NodeJS.ProcessEnv;
}

/**
 * The intent is re-resolved from the same inputs the starting command stamped
 * on the manifest, so the progress view's ship row and the ship here cannot
 * disagree.
 *
 * A `--ship` against an unusable ticket pattern exits 1 rather than skipping
 * silently, because the user is not getting the ship they asked for. A blocked
 * ship after a passed run also exits 1: the code is verified, the merge is not
 * done.
 *
 * The tracker write comes last, because it can fail without undoing anything.
 *
 * @returns the code the command exits with; the caller exits with it
 */
export const shipAfterImplement = async ({ config, cwd, result, shipFlag, noShipFlag, env }: Params): Promise<number> => {
	const terms = await readWorkOrderRunTerms({
		cwd,
		name: await planNameFromPath({ cwd, planPath: result.manifest.plan }),
		planPath: result.manifest.pipeline === PipelineKind.Direct ? undefined : result.manifest.plan,
	});
	const intent = resolveShipIntent({ config, shipFlag, noShipFlag, env, shipRequest: terms.shipRequest });

	if (intent.contradictory) {
		console.error(contradictoryShipFlagsMessage);

		return 1;
	}

	if (!result.ok || !intent.willShip) {
		// A passed run the ticket held back is not a failure, so the reason is a
		// printed sentence and the exit code is still the run's own.
		if (result.ok && intent.shipRequestBlocker !== undefined) {
			console.log(intent.shipRequestBlocker);
		}

		return getRunResultExitCode({ ok: result.ok, manifest: result.manifest });
	}

	if (intent.settings === undefined) {
		console.error(unusableTicketPatternMessage);

		return 1;
	}

	// A gate, a push or a merge run against the checkout the command was launched
	// from would act on a tree the run was never building in, so the ship goes
	// where the run's own records say the work happened.
	const resolved = await resolveRunCwd({ cwd, manifest: result.manifest });

	if ('error' in resolved) {
		console.error(resolved.error);

		return 1;
	}

	const workCwd = resolved.workspace;

	// Same harness the run itself used: the branch reaching the remote has the
	// default branch merged into it, and settling that is implementation work.
	const { config: effectiveConfig, driver } = resolveEffectiveConfigAndDriver({ config, command: 'implement' });
	const shipped = await runShip({
		cwd: workCwd,
		settings: intent.settings,
		integration: { config: effectiveConfig, driver },
		workOrderGuard: createWorkOrderShipGuard({ config, env, onProgress: createProgressPrinter() }),
		onProgress: createProgressPrinter(),
	});

	if (shipped.status === ShipStatus.Blocked) {
		return 1;
	}

	// Only now that the merge is confirmed.
	await removeShippedRunWorkspace({ cwd: workCwd, manifest: result.manifest, onProgress: createProgressPrinter() });

	// The merge is confirmed here too, so the tracker learns it here too — and a
	// refused write is a printed sentence rather than a changed exit code,
	// because a tracker failure cannot undo a merge that already happened.
	const reconciliationFailure = await reconcileShippedTicket({ config, env, ticketRef: shipped.ticketRef, onProgress: createProgressPrinter() });

	if (reconciliationFailure !== undefined) {
		console.error(reconciliationFailure);
	}

	return getRunResultExitCode({ ok: result.ok, manifest: result.manifest });
};
