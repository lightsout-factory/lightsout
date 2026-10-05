import type { LeftBehindTicket } from '#src/common/types/LeftBehindTicket.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import { reconcileMergedTickets } from '#src/queue/ticketSelection/reconcileMergedTickets.ts';

interface Params {
	/** The main repository checkout. */
	cwd: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	/** The wave's named work orders, and the entries the scan has already settled. */
	workOrders: NamedWorkOrder[];
	skipped: LeftBehindTicket[];
	/** Runs a task with no other main-checkout git mutation in flight. Reconciling a merged ticket removes its worktree from the main checkout. */
	serializeMainCheckout: <Result>(params: { task: () => Promise<Result> }) => Promise<Result>;
	onProgress?: (message: string) => void;
}

/**
 * Reconciled work orders join the skips because that marks them attempted, so
 * no later scan offers work that already shipped. The reconciliation takes the
 * shared chain: it removes a worktree from the main checkout while a builder may
 * be adding one there.
 */
export const settleMergedSelection = async ({
	cwd,
	config,
	env,
	workOrders,
	skipped,
	serializeMainCheckout,
	onProgress,
}: Params): Promise<{ workOrders: NamedWorkOrder[]; skipped: LeftBehindTicket[] }> => {
	const reconciled = await serializeMainCheckout({
		task: () => reconcileMergedTickets({ cwd, config, env, tickets: workOrders, onProgress }),
	});

	return { workOrders: reconciled.kept, skipped: [...skipped, ...reconciled.leftBehind] };
};
