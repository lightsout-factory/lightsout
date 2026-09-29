import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { readResumedPlanName } from '#src/cli/internal/common/implementRun/readResumedPlanName.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { resolveCommandShipIntent } from '#src/cli/internal/common/utils/resolveCommandShipIntent.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { ShipIntent } from '#src/ship/common/types/ShipIntent.ts';
import { requireImplementLifecycle } from '#src/ticketLifecycle/requireImplementLifecycle.ts';
import { readWorkOrderRunTerms } from '#src/workOrder/implementRun/readWorkOrderRunTerms.ts';

interface Params {
	/** The checkout the parked run recorded its source work in. */
	workspace: string;
	/** The parked run being continued. */
	manifest: RunManifest;
	/** The repository's config as read, before any harness resolution. */
	loaded: LightsoutConfig;
	flags: CommandContext['flags'];
}

/**
 * Everything a continuation has to clear before anything is mutated, all asked
 * of the workspace, because the branch the run builds on is the one they answer
 * for. A plan the ticket has since taken out of the order leaves no trace of
 * having been resumed: no tracker write, no restamped manifest.
 *
 * Each refusal is reported here and answered as undefined, so the caller has
 * only to exit.
 */
export const readResumeClearance = async ({
	workspace,
	manifest,
	loaded,
	flags,
}: Params): Promise<{ name: string | undefined; shipIntent: ShipIntent } | undefined> => {
	const name = await readResumedPlanName({ cwd: workspace, manifest });
	const terms = await readWorkOrderRunTerms({
		cwd: workspace,
		name,
		planPath: manifest.pipeline === PipelineKind.Direct ? undefined : manifest.plan,
	});

	if (terms.refusal !== undefined) {
		console.error(terms.refusal);

		return undefined;
	}

	// A resumed run ships on the same terms a first run does, settled here rather
	// than inherited from the parked run.
	const shipIntent = resolveCommandShipIntent({ config: loaded, flags, env: process.env, shipRequest: terms.shipRequest });

	if (shipIntent === undefined) {
		return undefined;
	}

	// Every pipeline here writes source, so each owes the pre-source lifecycle
	// write, which also refuses a ticket under a gate hold. No `ticketRef`: a
	// resumed run is ticket-backed through its branch, which the guard reads.
	const refusal = await requireImplementLifecycle({ cwd: workspace, config: loaded, env: process.env, onProgress: createProgressPrinter() });

	if (refusal !== undefined) {
		console.error(refusal);

		return undefined;
	}

	return { name, shipIntent };
};
