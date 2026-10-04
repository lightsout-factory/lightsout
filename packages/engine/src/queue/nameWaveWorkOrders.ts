import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { QueueWorker } from '#src/queue/common/constants/QueueWorker.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import type { LeftBehindTicket } from '#src/queue/internal/common/types/LeftBehindTicket.ts';
import type { RunnableTicket } from '#src/queue/internal/common/types/RunnableTicket.ts';
import { createWorkOrder } from '#src/workOrder/createWorkOrder.ts';
import { findWorkOrderByTicketRef } from '#src/workOrder/findWorkOrderByTicketRef.ts';

interface Params {
	/** The MAIN repository checkout — where the records live and where a new one is written. */
	cwd: string;
	config: LightsoutConfig;
	/** The process environment the tracker credentials are read from. Passed rather than read, so a test never mutates `process.env`. */
	env: NodeJS.ProcessEnv;
	/** The harness the name summariser spawns, so a queued work order is named exactly the way `work-order new` names one. */
	driver: Driver;
	/** The tickets this scan admitted, in the order they will be picked up. */
	tickets: RunnableTicket[];
	onProgress?: (message: string) => void;
}

/**
 * A ticket built from its body has exactly one implementation, so its record
 * starts single-plan whatever the repository default says; an auto-plan ticket
 * is planned first, so it keeps the default. Keyed by every worker, so a new one
 * is a type error until placed.
 */
const creationModeByWorker: Record<QueueWorker, WorkOrderMode | undefined> = {
	[QueueWorker.Direct]: WorkOrderMode.SinglePlan,
	[QueueWorker.Plan]: WorkOrderMode.SinglePlan,
	[QueueWorker.AutoPlan]: undefined,
};

const nameOne = async ({ cwd, config, env, driver, ticket, onProgress }: Omit<Params, 'tickets'> & { ticket: RunnableTicket }) => {
	const existing = await findWorkOrderByTicketRef({ cwd, ticketRef: ticket.identifier });

	if (existing !== undefined) {
		return { name: existing.name, branch: existing.record.branch };
	}

	// A creation that FAILS is caught here rather than thrown: this runs inside
	// the drain's scan loop, so one tracker timeout or one lock it could not take
	// would otherwise end a whole wave.
	const created = await createWorkOrder({
		cwd,
		ticketRef: ticket.identifier,
		mode: creationModeByWorker[ticket.worker],
		config,
		env,
		driver,
		onProgress,
	}).catch((thrown: unknown) => ({
		error: `no work order could be created for ${ticket.identifier}: ${messageOf({ error: thrown })}`,
	}));

	return 'error' in created ? created : { name: created.name, branch: created.branch };
};

/**
 * A ticket that could not be named becomes a left-behind entry: the queue never
 * invents a name for work `createWorkOrder` declined to name.
 *
 * Sequential because a name collision has to be refused against every name
 * already allocated, which two concurrent creations could not see.
 */
export const nameWaveWorkOrders = async ({
	cwd,
	config,
	env,
	driver,
	tickets,
	onProgress,
}: Params): Promise<{ named: NamedWorkOrder[]; leftBehind: LeftBehindTicket[] }> => {
	const named: NamedWorkOrder[] = [];
	const leftBehind: LeftBehindTicket[] = [];

	for (const ticket of tickets) {
		const settled = await nameOne({ cwd, config, env, driver, ticket, onProgress });

		if ('error' in settled) {
			onProgress?.(`${ticket.identifier} · ${settled.error}`);
			leftBehind.push({ identifier: ticket.identifier, title: ticket.title, url: ticket.url, reason: settled.error });
		} else {
			named.push({ ticket, name: settled.name, branch: settled.branch });
		}
	}

	return { named, leftBehind };
};
