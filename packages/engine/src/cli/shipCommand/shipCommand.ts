import { unusableTicketPatternMessage } from '#src/cli/common/constants/unusableTicketPatternMessage.ts';
import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { resolveEffectiveConfigAndDriver } from '#src/cli/common/resolveEffectiveConfigAndDriver.ts';
import { readGitIdentity } from '#src/cli/shipCommand/readGitIdentity.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { exitCli } from '#src/common/exitCli.ts';
import { readGitCurrentBranch } from '#src/common/git/readGitCurrentBranch.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { resolveWorkOrderNameForBranch } from '#src/common/workspace/resolveWorkOrderNameForBranch.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { resolveShipSettings } from '#src/ship/resolveShipSettings.ts';
import { runShip } from '#src/ship/runShip/runShip.ts';
import { reconcileShippedTicket } from '#src/ticketLifecycle/reconcileShippedTicket/reconcileShippedTicket.ts';
import { createWorkOrderShipGuard } from '#src/workOrder/implementRun/createWorkOrderShipGuard.ts';
import { authorizeHandBuiltShip } from '#src/workOrder/shipping/authorizeHandBuiltShip.ts';

/**
 * Records the person's authorization on the branch's work order before any ship starts, and
 * answers the refusal when there is one. A publish failure is only a warning: the authorization is
 * saved on this machine, which is where the ship's guard reads it.
 */
const authorizeHandBuiltWork = async ({ cwd, config }: { cwd: string; config: LightsoutConfig }) => {
	const branch = await readGitCurrentBranch({ cwd });

	if (branch === undefined) {
		return 'HEAD names no branch, so no work order is being shipped and there is no hand-built work to authorize — check out the branch to ship first';
	}

	const authorized = await authorizeHandBuiltShip({
		cwd,
		name: await resolveWorkOrderNameForBranch({ cwd, branch }),
		branch,
		identity: await readGitIdentity({ cwd }),
		config,
		env: process.env,
		onProgress: createProgressPrinter(),
	});
	let refusal: string | undefined;

	if ('error' in authorized) {
		refusal = authorized.error;
	} else {
		if (authorized.notice !== undefined) {
			console.log(authorized.notice);
		}

		if (authorized.publishError !== undefined) {
			console.error(`warning: ${authorized.publishError}`);
		}
	}

	return refusal;
};

// An unusable `ship.ticket-pattern` and a refused hand-built authorization are
// both refused here, before the ship sequence, so no result file is written: no
// run happened.
export const shipCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const config = await readConfig({ cwd });
	const settings = resolveShipSettings({ config });

	if (settings === undefined) {
		console.error(unusableTicketPatternMessage);
		return exitCli({ code: 1 });
	}

	if (flags.get('hand-built') === true) {
		const refusal = await authorizeHandBuiltWork({ cwd, config });

		if (refusal !== undefined) {
			console.error(refusal);
			return exitCli({ code: 1 });
		}
	}

	// The `implement` entry, not the top-level harness: resolving a merge conflict
	// and repairing a red gate is implementation work.
	const { config: effectiveConfig, driver } = resolveEffectiveConfigAndDriver({ config, command: 'implement' });
	const result = await runShip({
		cwd,
		settings,
		integration: { config: effectiveConfig, driver },
		// The branch's own ticket record has the last word on the merge, here as
		// much as in the queue: a standalone ship is not a way around it.
		workOrderGuard: createWorkOrderShipGuard({ config, env: process.env, onProgress: createProgressPrinter() }),
		onProgress: createProgressPrinter(),
	});

	if (result.status === ShipStatus.Shipped) {
		console.log(`shipped ${result.ticketRef}: pull request #${result.prNumber} merged as ${result.mergeCommit}`);
		console.log(`  ${result.prUrl}`);

		// A tracker that refuses the write does not change the exit code: the merge
		// happened.
		const reconciliationFailure = await reconcileShippedTicket({ config, env: process.env, ticketRef: result.ticketRef, onProgress: createProgressPrinter() });

		if (reconciliationFailure !== undefined) {
			console.error(reconciliationFailure);
		}

		return exitCli({ code: 0 });
	}

	console.error(`ship blocked (${result.reason}): ${result.detail}`);

	if (result.failingChecks.length > 0) {
		console.error(`  checks: ${result.failingChecks.join(', ')}`);
	}

	return exitCli({ code: 1 });
};
