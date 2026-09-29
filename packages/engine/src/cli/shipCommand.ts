import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { unusableTicketPatternMessage } from '#src/cli/internal/common/constants/unusableTicketPatternMessage.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { resolveEffectiveConfigAndDriver } from '#src/cli/internal/common/utils/resolveEffectiveConfigAndDriver.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { resolveShipSettings } from '#src/ship/resolveShipSettings.ts';
import { runShip } from '#src/ship/runShip.ts';
import { reconcileShippedTicket } from '#src/ticketLifecycle/reconcileShippedTicket.ts';
import { createWorkOrderShipGuard } from '#src/workOrder/implementRun/createWorkOrderShipGuard.ts';

// An unusable `ship.ticket-pattern` is refused here, before the ship sequence,
// so no result file is written: no run happened.
export const shipCommand = async ({ cwd }: CommandContext): Promise<void> => {
	const config = await readConfig({ cwd });
	const settings = resolveShipSettings({ config });

	if (settings === undefined) {
		console.error(unusableTicketPatternMessage);
		return exitCli({ code: 1 });
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
